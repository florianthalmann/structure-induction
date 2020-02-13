import * as _ from 'lodash';
import { indexOfMax } from 'arrayutils';
import { StructureResult, MultiStructureResult, CacheableStructureOptions } from './structure';
import { loadOrPerformAndCache } from './util';
import { SmithWaterman, SmithWatermanResult, TRACES } from './smith-waterman';

export interface IterativeSmithWatermanResult extends StructureResult {
  matrices: SmithWatermanResult[],
  segmentMatrix: number[][]
}

export interface MultiSmithWatermanResult extends MultiStructureResult,
  IterativeSmithWatermanResult {}

export interface SmithWatermanOptions extends CacheableStructureOptions {
  maxIterations?: number,
  maxThreshold?: number,
  endThreshold?: number,
  minSegmentLength?: number,
  similarityThreshold?: number,
  onlyDiagonals?: boolean,
  nLongest?: number,
  fillGaps?: boolean,
  maxGapSize?: number,
  maxGaps?: number,
  minDistance?: number, //min distance between parallel segments: 1 == directly adjacent, 2 == gap of one
  cacheDir?: string
}

function getSWOptionsString(options: SmithWatermanOptions) {
  return (options.maxIterations ? options.maxIterations : 't')//t to be backwards-compatible with iterative t/f save files
    +'_'+ (options.maxThreshold ? options.maxThreshold : '')//0 == undefined
    +'_'+ (options.endThreshold ? options.endThreshold : '')//0 == undefined
    +'_'+ (options.minSegmentLength ? options.minSegmentLength : '')//0 == undefined
    +'_'+ (options.similarityThreshold != null ? options.similarityThreshold : '')
    +'_'+ (options.onlyDiagonals ? 't' : '')
    +'_'+ (options.nLongest ? options.nLongest : '')
    +'_'+ (options.maxGapSize ? options.maxGapSize : '')
    +'_'+ (options.maxGaps ? options.maxGaps : '')
    +'_'+ (options.minDistance ? options.minDistance : '')
}

export function getMultiSWOccurrences(points: number[][], points2: number[][],
    options: SmithWatermanOptions): MultiSmithWatermanResult {
  const file = 'sw_'+getSWOptionsString(options)+'.json';
  return loadOrPerformAndCache(file,
    () => Object.assign(
      getSmithWatermanOccurrences2(points, options, points2), {points2: points2}),
    options);
}

export function getSmithWatermanOccurrences(points: number[][],
    options: SmithWatermanOptions): IterativeSmithWatermanResult {
  const file = 'sw_'+getSWOptionsString(options)+'.json';
  return loadOrPerformAndCache(file,
    () => getSmithWatermanOccurrences2(points, options), options);
}

function getSmithWatermanOccurrences2(points: number[][],
    options: SmithWatermanOptions, points2?: number[][]) {
  let result: IterativeSmithWatermanResult = {points: points, patterns:[], matrices:[], segmentMatrix:[]};
  const symmetric = !points2 || _.isEqual(points2, points);
  const padding = options.minDistance ? options.minDistance-1 : 0;
  if (symmetric) points2 = points;
  const selectedPoints: number[][] = [];
  const ignoredPoints = new Set<string>();
  //ignore diagonal if symmetric (with padding depending on minDistance)
  if (symmetric) addPaddedSegments(points.map((_p,i) => [i,i]), ignoredPoints, padding, symmetric);
  let matrices = getAdjustedSWMatrices(points, points2, options.similarityThreshold, result, ignoredPoints);
  var max: number, i: number, j: number;
  [i, j, max] = getIJAndMax(matrices.scoreMatrix);
  let iterations = 0;

  while ((!options.maxThreshold || max > options.maxThreshold)
      && (!options.maxIterations || iterations < options.maxIterations)) {
    iterations++;
    let currentPoints = getAlignment(matrices, i, j, options);
    let currentSegments = toSegments(currentPoints);

    //only add if longer than minSegmentLength
    if (currentSegments.length > 0
        && (!options.minSegmentLength || (currentSegments[0].length > options.minSegmentLength
          && currentSegments[1].length > options.minSegmentLength))) {
      let dist = currentSegments[1][0]-currentSegments[0][0];
      //console.log("current max: " + max, "current dist: " + dist, "\ncurrent points: " + JSON.stringify(currentPoints), "\ncurrent segments: " + JSON.stringify(currentSegments));
      const vector = points[0].map((_,i) => i == 0 ? dist : 0);
      const segmentPoints = currentSegments.map((s,i) => s.map(j => [points,points2][i][j]));
      //TODO ONLY ADD IF DIFFERENCE FROM EXISTING ONES SMALL ENOUGH!!!!!
      result.patterns.push({points: segmentPoints[0], vectors: [vector], occurrences: segmentPoints});
      selectedPoints.push(...currentPoints);
    }
    //update ignored points
    addPaddedSegments(currentPoints, ignoredPoints, padding, symmetric);
    if (!options.maxIterations || iterations < options.maxIterations) {
      matrices = getAdjustedSWMatrices(points, points2, options.similarityThreshold, result, ignoredPoints);
      [i, j, max] = getIJAndMax(matrices.scoreMatrix);
    }
  }
  result.segmentMatrix = createPointMatrix(selectedPoints, points, points2);
  if (options.nLongest) {
    result.patterns = _.reverse(_.sortBy(result.patterns, p => p.points.length))
      .slice(0, options.nLongest);
  }
  return result;
}

function addPaddedSegments(segment: number[][], set: Set<string>,
    padding: number, symmetric: boolean) {
  segment.forEach(p => {
    const points = [p];
    points.push(..._.flatten(_.range(1, padding+1)
      .map(d => [[p[0]+d,p[1]], [p[0],p[1]+d]])));
    if (symmetric) _.cloneDeep(points)
      .forEach(i => points.push(_.reverse(i)));
    points.forEach(p => set.add(p.join(',')));
  });
}

function getAdjustedSWMatrices(points: number[][], points2: number[][],
    similarityThreshold: number, result: IterativeSmithWatermanResult, ignoredPoints: Set<string>) {
  //TODO MAKE SURE NO SLICING NEEDS TO HAPPEN (JUST RUN WITH COLLAPSED TEMPORAL FEATURES??)
  //points = points.map(p => p.slice(0,p.length-1));
  points = points.map(p => p.slice(1));
  points2 = points2.map(p => p.slice(1));
  let matrices = new SmithWaterman(similarityThreshold)
    .run(points, points2, ignoredPoints);
  if (points === points2) {
    //make lower matrix 0
    matrices.scoreMatrix = matrices.scoreMatrix.map((r,i) => r.map((c,j) => j < i ? 0 : c));
  }
  result.matrices.push(_.clone(matrices));
  
  /*if (points.length <= points2.length) {
    //make lower matrix 0
    matrices.scoreMatrix = matrices.scoreMatrix.map((r,i) => r.map((c,j) => j < i ? 0 : c));
  } else {
    matrices.scoreMatrix = matrices.scoreMatrix.map((r,i) => r.map((c,j) => j > i ? 0 : c));
  }*/
  return matrices;
}

function createPointMatrix(selectedPoints: number[][], points: number[][], points2: number[][]): number[][] {
  const matrix = getEmptyMatrix(points, points2);
  selectedPoints.forEach(p => matrix[p[0]][p[1]] = 1);
  return matrix;
}

function createSegmentMatrix(segments: number[][][], points: number[][], points2: number[][]): number[][] {
  const matrix = getEmptyMatrix(points, points2);
  segments.forEach(s => s[0].forEach((s0,i) => matrix[s0][s[1][i]] = 1));
  return matrix;
}

function getEmptyMatrix(points: number[][], points2: number[][]) {
  let row = _.fill(new Array(points.length), 0);
  return row.map(m => _.fill(new Array(points2.length), 0));
}

function getAlignment(matrices: SmithWatermanResult, i: number, j: number, options: SmithWatermanOptions): number[][] {
  //find ij trace in matrix
  let currentValue = matrices.scoreMatrix[i][j];
  let currentTrace = matrices.traceMatrix[i][j];
  let pointsOnAlignment = [[i,j]];
  let numGaps = 0;
  let currentGapSize = 0;
  
  while ((!options.endThreshold || currentValue > options.endThreshold)
      && (!options.maxGapSize || currentGapSize <= options.maxGapSize)
      && (!options.maxGaps || numGaps <= options.maxGaps)) {
    //reset current location in matrix
    if (currentTrace === TRACES.DIAGONAL) {
      [i,j] = [i-1,j-1];
    } else if (currentTrace === TRACES.UP && !options.onlyDiagonals) {
      [i,j] = [i-1,j];
    } else if (currentTrace === TRACES.LEFT && !options.onlyDiagonals) {
      [i,j] = [i,j-1];
    }
    if (matrices.scoreMatrix[i][j] !== currentValue) {//next alignment found
      currentValue = matrices.scoreMatrix[i][j];
      currentTrace = matrices.traceMatrix[i][j];
      if (!options.onlyDiagonals || (currentTrace == TRACES.DIAGONAL &&
          //only add in strict diagonal version if it was a match
          currentValue > matrices.scoreMatrix[i-1][j-1])) {
        pointsOnAlignment.push([i,j]);
        currentGapSize = 0;
      } else {
        if (currentGapSize == 0) numGaps++;
        currentGapSize++;
      }
    } else break;
  }
  if (options.onlyDiagonals && options.fillGaps) {
    const f = _.first(pointsOnAlignment); //highest index
    const l = _.last(pointsOnAlignment); //lowest index
    pointsOnAlignment = _.zip(_.range(f[0],l[0]-1), _.range(f[1],l[1]-1));
  }
  return _.sortBy(pointsOnAlignment);
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