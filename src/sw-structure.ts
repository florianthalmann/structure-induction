import * as _ from 'lodash';
import * as math from 'mathjs';
import * as fs from 'fs';
import { indexOfMax } from 'arrayutils';
import { StructureResult } from './structure';
import { SmithWaterman, SmithWatermanResult, TRACES } from './smith-waterman';

export interface IterativeSmithWatermanResult extends StructureResult {
  //patterns: number[][][],
  matrices: SmithWatermanResult[],
  segmentMatrix: number[][],
}

export interface SmithWatermanOptions {
  iterative: boolean,
  similarityThreshold?: number,
  maxThreshold: number,
  endThreshold: number,
  minSegmentLength: number,
  onlyDiagonals?: boolean,
  patternIndices?: number[],
  cacheFile?: string
}

/**
 * relevant options are: iterative, similarityThreshold, maxThreshold, endThreshold, minSegmentLength, patternIndices
 */
export function getSmithWatermanOccurrences(points: number[][], options: SmithWatermanOptions): IterativeSmithWatermanResult {
  let result: IterativeSmithWatermanResult = {points: points, patterns:[], matrices:[], segmentMatrix:[]};
  let matrices = getAdjustedSWMatrices(points, options.similarityThreshold, result);
  var max: number, i: number, j: number;
  [i, j, max] = getIJAndMax(matrices.scoreMatrix);
  var allSelectedPoints: number[][] = [];
  
  if (options.cacheFile) {
    fs.writeFileSync(options.cacheFile, JSON.stringify(matrices.scoreMatrix));
  }
  
  //console.log(points)

  while (max > options.maxThreshold) {
    let currentPoints = getAlignment(matrices, i, j, options.endThreshold, options.onlyDiagonals);
    let currentSegments = toSegments(currentPoints);

    //only add if longer than minSegmentLength
    if (currentSegments[0].length > options.minSegmentLength && currentSegments[1].length > options.minSegmentLength) {
      let dist = currentSegments[1][0]-currentSegments[0][0];
      //console.log("current max: " + max, "current dist: " + dist, "\ncurrent points: " + JSON.stringify(currentPoints), "\ncurrent segments: " + JSON.stringify(currentSegments));
      const vector = points[0].map((_,i) => i == 0 ? dist : 0);
      const segmentPoints = currentSegments.map(s => s.map(i => points[i]));
      //TODO ONLY ADD IF DIFFERENCE FROM EXISTING ONES SMALL ENOUGH!!!!!
      result.patterns.push({points: segmentPoints[0], vectors: [vector], occurrences: segmentPoints});
      //add reflections at diagonal
      currentPoints = currentPoints.concat(currentPoints.map(p => _.reverse(_.clone(p))));
      //console.log(JSON.stringify(segmentPoints))
      allSelectedPoints = allSelectedPoints.concat(currentPoints);
      if (options.iterative) {
        matrices = getAdjustedSWMatrices(points, options.similarityThreshold, result, allSelectedPoints);
      }
    }
    [i, j, max] = getIJAndMax(matrices.scoreMatrix);
  }
  //filter out requested segments (via patternIndices)
  if (options.patternIndices) {
    result.patterns = result.patterns.filter((s,i) => options.patternIndices.indexOf(i) >= 0);
  }
  result.segmentMatrix = createPointMatrix(allSelectedPoints, points.length);
  return result;
}

function getAdjustedSWMatrices(points: number[][], similarityThreshold: number, result: IterativeSmithWatermanResult, ignoredPoints?) {
  //TODO MAKE SURE NO SLICING NEEDS TO HAPPEN (JUST RUN WITH COLLAPSED TEMPORAL FEATURES??)
  //points = points.map(p => p.slice(0,p.length-1));
  points = points.map(p => p.slice(1));
  let matrices = new SmithWaterman(similarityThreshold).run(points, points, ignoredPoints);
  result.matrices.push(_.clone(matrices));
  //make lower matrix 0
  matrices.scoreMatrix = matrices.scoreMatrix.map((r,i) => r.map((c,j) => j < i ? 0 : c));
  return matrices;
}

function createPointMatrix(selectedPoints: number[][], totalPoints: number): number[][] {
  let row = _.fill(new Array(totalPoints), 0);
  let matrix = row.map(m => _.fill(new Array(totalPoints), 0));
  selectedPoints.forEach(p => matrix[p[0]][p[1]] = 1);
  return matrix;
}

function createSegmentMatrix(segments: number[][][]): number[][] {
  let maxIndex = math.max(segments);
  let row = _.fill(new Array(maxIndex+1), 0);
  let matrix = row.map(m => _.fill(new Array(maxIndex+1), 0));
  segments.forEach(s => s[0].forEach((s0,i) => matrix[s0][s[1][i]] = 1));
  return matrix;
}

function getAlignment(matrices: SmithWatermanResult, i: number, j: number, endThreshold?: number, onlyDiagonals?: boolean): number[][] {
  //find ij trace in matrix
  let currentValue = matrices.scoreMatrix[i][j];
  let currentTrace = matrices.traceMatrix[i][j];
  let pointsOnAlignment = [[i,j]];
  while (currentValue > endThreshold) {
    //reset current location in matrix
    //TODO DONT NEED DO THIS!!!!!
    matrices.scoreMatrix[i][j] = 0;//-= 3;
    if (currentTrace === TRACES.DIAGONAL) {
      [i,j] = [i-1,j-1];
    } else if (currentTrace === TRACES.UP && !onlyDiagonals) {
      [i,j] = [i-1,j];
    } else if (currentTrace === TRACES.LEFT && !onlyDiagonals) {
      [i,j] = [i,j-1];
    }
    if (matrices.scoreMatrix[i][j] !== currentValue) {//next alignment found
      currentValue = matrices.scoreMatrix[i][j];
      currentTrace = matrices.traceMatrix[i][j];
      if (!onlyDiagonals //only add in strict diagonal version if it was a match
          || (currentTrace == TRACES.DIAGONAL && currentValue > matrices.scoreMatrix[i-1][j-1])) {
        pointsOnAlignment.push([i,j]);
      }
    } else break;
  }
  return pointsOnAlignment;
}

function toSegments(alignmentPoints: number[][]) {
  let currentSegments = _.zip(...alignmentPoints);
  //sort ascending
  currentSegments.forEach(o => o.sort((a,b) => a-b));
  //remove duplicates
  return currentSegments.map(occ => _.uniq(occ));
}

function getIJAndMax(matrix: number[][]): number[] {
  let ijAndMaxes = matrix.map((row,i) => [i].concat(getIAndMax(row)));
  let index = indexOfMax(ijAndMaxes.map(m => m[2]));
  return ijAndMaxes[index];
}

function getIAndMax(array: number[]): number[] {
  let iAndMax = [-1, 0];
  array.forEach((x, i) => { if (x > iAndMax[1]) iAndMax = [i, x] });
  return iAndMax;
}

/*getSmithWatermanOccurrences(options): number[][][] {
  let points = quantizedPoints.map(p => p.slice(0,3));
  let result = new SmithWaterman().run(points, points);
  let sw = result.scoreMatrix;
  let trace = result.traceMatrix;
  //make lower matrix 0
  sw = sw.map((r,i) => r.map((c,j) => j < i ? 0 : c));
  var max: number, i: number, j: number;
  [i, j, max] = getIJAndMax(sw);
  var segments: number[][][] = [];
  while (max > options.maxThreshold) {
    //find ij trace in matrix
    let currentValue = max;
    let currentTrace = trace[i][j];
    let currentSegments = [[i],[j]];
    while (currentValue > options.endThreshold) {
      //reset current location in matrix
      sw[i][j] = 0;//-= 3;
      if (currentTrace === TRACES.DIAGONAL) {
        [i,j] = [i-1,j-1];
      } else if (currentTrace === TRACES.UP) {
        [i,j] = [i-1,j];
      } else if (currentTrace === TRACES.LEFT) {
        [i,j] = [i,j-1];
      } else {
        break;
      }
      currentSegments[0].push(i);
      currentSegments[1].push(j);
      currentValue = sw[i][j];
      currentTrace = trace[i][j];
    }

    //sort ascending
    currentSegments.forEach(o => o.sort((a,b) => a-b));
    //remove duplicates
    currentSegments = currentSegments.map(occ => _.uniq(occ));

    //let allPoints = _.union(_.flatten(segments.map(s => _.union(...s))));
    //let newPoints = currentSegments.map(occ => _.difference(occ, allPoints));
    //only add if longer than minSegmentLength
    if (currentSegments[0].length > options.minSegmentLength && currentSegments[1].length > options.minSegmentLength) { //(newPoints[0].length > minSegmentLength && newPoints[1].length > minSegmentLength) {
      //TODO ONLY ADD IF DIFFERENCE FROM EXISTING ONES SMALL ENOUGH!!!!!
      segments.push(currentSegments);
    }
    let ijMax = getIJAndMax(sw);
    i = ijMax[0];
    j = ijMax[1];
    max = ijMax[2];
  }
  //filter out wanted segments
  if (options.patternIndices) {
    segments = segments.filter((s,i) => options.patternIndices.indexOf(i) >= 0);
  }
  console.log(JSON.stringify(segments));
  return segments;
}*/