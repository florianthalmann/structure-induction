import * as _ from 'lodash';
import { StructureResult, MultiStructureResult, CacheableStructureOptions, Pattern } from './structure';
import { loadOrPerformAndCache, loadCached, modForReal } from './util';
import { SmithWaterman, SmithWatermanResult, TRACES, GAP_SCORE } from './smith-waterman';

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
  maxGapRatio?: number,
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
    +'_'+ (options.maxGapSize != null ? options.maxGapSize : '')
    +'_'+ (options.maxGaps ? options.maxGaps : '')
    +'_'+ (options.maxGapRatio ? options.maxGapRatio : '')
    +'_'+ (options.minDistance ? options.minDistance : '')
}

export function getSimpleSmithWatermanPath(points: number[][],
    points2: number[][], options: SmithWatermanOptions) {
  const matrices = new SmithWaterman(options.similarityThreshold)
    .run(points, points2)
  return getBestAlignment(matrices, options);
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
  const symmetric = !points2 || _.isEqual(points2, points);
  const padding = options.minDistance ? options.minDistance-1 : 0;
  if (symmetric) points2 = points;
  const allMatrices = [];
  
  const speedyResult = tryAndGetFromUnlimited(options, symmetric);
  if (speedyResult) return speedyResult;
  
  let selectedAlignments: [number,number][][] = [];
  const ignoredPoints = new Set<string>();
  //ignore diagonal if symmetric (with padding depending on minDistance)
  if (symmetric) getPaddedArea(points.map((_p,i) => [i,i]), padding, symmetric,
    points.length-1, points.length-1).forEach(p => ignoredPoints.add(p.join(',')));
  let matrices = getAdjustedSWMatrices(points, points2, options.similarityThreshold, ignoredPoints);
  allMatrices.push(_.clone(matrices));
  let iterations = 0;
  let max = _.max(_.flatten(matrices.scoreMatrix));
  const maxThreshold = options.maxThreshold || 0;
  
  while (max > maxThreshold
      && (!options.maxIterations || iterations < options.maxIterations)) {
    iterations++;
    //extract alignments
    const currentAlignments = getAlignments(matrices, options, symmetric);
    if (currentAlignments.length == 0) break;
    selectedAlignments.push(...currentAlignments);
    //update ignored points (with all found ones, not only long ones)
    currentAlignments.forEach(a => 
      getPaddedArea(a, padding, symmetric, points.length-1, points2.length-1)
        .forEach(p => ignoredPoints.add(p.join(','))));
    //prepare for next iteration
    if (!options.maxIterations || iterations < options.maxIterations) {
      matrices = getAdjustedSWMatrices(points, points2, options.similarityThreshold, ignoredPoints);
      max = _.max(_.flatten(matrices.scoreMatrix));
      if (max > 0) {
        allMatrices.push(_.clone(matrices));
      }
    }
  }
  
  return getResult(selectedAlignments, options, points, points2, symmetric,
    padding, allMatrices);
}

function getResult(alignments: [number,number][][],
    options: SmithWatermanOptions, points: number[][], points2: number[][],
    symmetric: boolean, padding: number, matrices: SmithWatermanResult[]) {
  let result: IterativeSmithWatermanResult =
    {points: points, patterns: [], matrices: matrices, segmentMatrix: []};
  //keep longest while respecting min dist
  alignments = reduceSegments(alignments, options,
    points.length, points2.length, symmetric, padding);
  //create segment matrix
  result.segmentMatrix = createPointMatrix(
    _.flatten(alignments), points, points2, symmetric);
  //convert to patterns
  result.patterns = toPatterns(alignments, points, points2);
  return result;
}

function tryAndGetFromUnlimited(options: SmithWatermanOptions, symmetric: boolean) {
  const unlimitedLongestOptions = _.clone(options)
  unlimitedLongestOptions.nLongest = undefined;
  const cached: MultiSmithWatermanResult = loadCached(
    'sw_'+getSWOptionsString(unlimitedLongestOptions)+'.json',
    options.cacheDir);
  if (cached) {
    const points = cached.points;
    const points2 = cached.points2 || points;
    //already sorted and spaced out, so just keep nLongest
    const alignments = cached.patterns.map(p =>
      patternToAlignment(p, points, points2)).slice(0, options.nLongest);
    let result: IterativeSmithWatermanResult =
      {points: points, patterns: [], matrices: cached.matrices, segmentMatrix: []};
    //create segment matrix
    result.segmentMatrix = createPointMatrix(
      _.flatten(alignments), points, points2, symmetric);
    //convert to patterns
    result.patterns = toPatterns(alignments, points, points2);
    return result;
  }
}

function reduceSegments(alignments: [number,number][][],
    options: SmithWatermanOptions, numPoints1: number, numPoints2: number,
    symmetric: boolean, padding: number) {
  //sort, longest first
  alignments = _.reverse(_.sortBy(alignments, a => a.length));
  const reduced: [number, number][][] = [];
  const matrix = getEmptyMatrix(numPoints1, numPoints2);
  //keep longest while respecting min dist
  while (alignments.length > 0
      && (!options.nLongest || reduced.length < options.nLongest)) {
    const currentAlignment = alignments.shift();
    const nooverlap = currentAlignment.filter(p => matrix[p[0]][p[1]] == 0);
    //add if not covered by any previous segment
    if (nooverlap.length == currentAlignment.length) {
      reduced.push(currentAlignment);
      getPaddedArea(currentAlignment, padding, symmetric, numPoints1-1,
        numPoints2-1).forEach(p => matrix[p[0]][p[1]] = 1);
    } else if (nooverlap.length >= options.minSegmentLength) {//add for later
      const i = alignments.findIndex(a => a.length == nooverlap.length);
      alignments.splice(i, 0, nooverlap);
    }
  }
  return reduced;
}

function toPatterns(alignments: [number,number][][], points: number[][], points2: number[][]) {
  return alignments.map(a => {
    const currentSegments = toSegments(a);
    const dist = currentSegments[1][0]-currentSegments[0][0];
    const vector = points[0].map((_,i) => i == 0 ? dist : 0);
    const segmentPoints = currentSegments.map((s,i) => s.map(j => [points,points2][i][j]));
    return {points: segmentPoints[0], vectors: [vector], occurrences: segmentPoints};
  });
}

function patternToAlignment(pattern: Pattern, points: number[][], points2: number[][]) {
  const stringPoints = points.map(p => JSON.stringify(p));
  const occ1Indexes = pattern.occurrences[0].map(p =>
    stringPoints.indexOf(JSON.stringify(p)));
  const stringPoints2 = points2.map(p => JSON.stringify(p));
  const occ2Indexes = pattern.occurrences[1].map(p =>
    stringPoints2.indexOf(JSON.stringify(p)));
  return _.zip(occ1Indexes, occ2Indexes);
}

function getPaddedArea(points: number[][], padding: number,
    symmetric: boolean, maxX: number, maxY: number) {
  return _.flatten(points.map(p => {
    const ps = [p];
    ps.push(..._.flatten(_.range(1, padding+1)
      .map(d => [[p[0]+d,p[1]], [p[0],p[1]+d]])));
    if (symmetric) _.cloneDeep(ps).forEach(i => ps.push(_.reverse(i)));
    return ps;
  })).filter(p => p[0] <= maxX && p[1] <= maxY);
}

function getAdjustedSWMatrices(points: number[][], points2: number[][],
    similarityThreshold: number, ignoredPoints: Set<string>) {
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
  
  /*if (points.length <= points2.length) {
    //make lower matrix 0
    matrices.scoreMatrix = matrices.scoreMatrix.map((r,i) => r.map((c,j) => j < i ? 0 : c));
  } else {
    matrices.scoreMatrix = matrices.scoreMatrix.map((r,i) => r.map((c,j) => j > i ? 0 : c));
  }*/
  return matrices;
}

function createPointMatrix(selectedPoints: number[][], points: number[][],
    points2: number[][], symmetric: boolean): number[][] {
  const matrix = getEmptyMatrix(points.length, points2.length);
  selectedPoints.forEach(p => matrix[p[0]][p[1]] = 1);
  if (symmetric) selectedPoints.forEach(p => matrix[p[1]][p[0]] = 1);
  return matrix;
}

function getEmptyMatrix(numRows: number, numCols: number) {
  return _.range(0, numRows).map(_r => _.fill(new Array(numCols), 0));
}

function getBestAlignment(matrices: SmithWatermanResult, options: SmithWatermanOptions) {
  const flat = _.flatten(matrices.scoreMatrix);
  const index = flat.indexOf(_.max(flat));
  const numCols = matrices.scoreMatrix[0].length;
  const [i, j] = [_.floor(index/numCols), modForReal(index, numCols)];
  const alignment = getAlignment(matrices, i, j, options);
  //keep only matches
  return alignment.filter(([i, j]) => matrices.traceMatrix[i][j] == TRACES.DIAGONAL
    && matrices.scoreMatrix[i][j] > matrices.scoreMatrix[i-1][j-1]);
}

function getAlignments(matrices: SmithWatermanResult, options: SmithWatermanOptions,
    symmetric: boolean) {
  let currentMatrix = _.cloneDeep(matrices.scoreMatrix);
  let currentMatrices = _.cloneDeep(matrices);
  currentMatrices.scoreMatrix = currentMatrix;
  const alignments: [number,number][][] = [];
  
  let maxes = <[number, number, number][]>
    _.flatten(currentMatrix.map((r,i) => r.map((v,j) => [v,i,j])));
  maxes = maxes.filter(vij => options.maxThreshold ?
    vij[0] > options.maxThreshold : vij[0] > 0);
  maxes = _.reverse(_.sortBy(maxes, vij => vij[0]));
  
  while (maxes.length > 0) {
    const [i, j] = [maxes[0][1], maxes[0][2]];
    let currentAlignment = getAlignment(currentMatrices, i, j, options);
    
    if ((!options.minSegmentLength || currentAlignment.length >= options.minSegmentLength))
      alignments.push(currentAlignment);
    removeAlignmentCoverage(currentAlignment, currentMatrix, symmetric,
      options.onlyDiagonals);
    const nextMax = maxes.findIndex(m => currentMatrix[m[1]][m[2]] != 0);
    maxes = maxes.slice(nextMax > 1 ? nextMax : 1);
  }
  return alignments;
}

function removeAlignmentCoverage(alignment: [number,number][],
    matrix: number[][], symmetric: boolean, diagonal: boolean) {
  //remove diagonal bleeding at end of alignment (until next match)
  if (alignment.length > 0 && diagonal) {
    alignment = _.clone(alignment);
    let current = _.last(alignment);
    let currentValue = matrix[current[0]][current[1]];
    let next: [number, number] = [current[0]+1, current[1]+1];
    while (next[0] < matrix.length && next[1] < matrix.length
        && matrix[next[0]][next[1]] < currentValue) {
      alignment.push(next);
      currentValue = matrix[next[0]][next[1]];
      next = [next[0]+1, next[1]+1];
    }
  }
  //remove horizontal and vertical bleeding (any gaps)
  alignment.forEach(([i,j]) => {
    let ii = i+1, jj = j+1;
    let currentValue = matrix[i][j];
    while (ii < matrix.length && matrix[ii][j] <= currentValue+GAP_SCORE) {
      currentValue = matrix[ii][j];
      matrix[ii][j] = 0;
      if (symmetric) matrix[j][ii] = 0;
      ii++;
    }
    currentValue = matrix[i][j];
    while (jj < matrix[0].length && matrix[i][jj] <= currentValue+GAP_SCORE) {
      currentValue = matrix[i][jj];
      matrix[i][jj] = 0;
      if (symmetric) matrix[jj][i] = 0;
      jj++;
    }
    matrix[i][j] = 0;
    if (symmetric) matrix[j][i] = 0;
  });
}

function getAlignment(matrices: SmithWatermanResult, i: number, j: number, options: SmithWatermanOptions): [number,number][] {
  const maxGapSize = options.maxGapSize || 0;
  const maxGaps = options.maxGaps || 0;
  const maxGapRatio = options.maxGapRatio || 1;
  //find ij trace in matrix
  let currentValue = matrices.scoreMatrix[i][j];
  let currentTrace = matrices.traceMatrix[i][j];
  let pointsOnAlignment: [number, number][] = [[i,j]];
  let numGaps = 0;
  let currentGapSize = 0;
  let totalGapSize = 0;
  let gapRatio = 0;
  while ((!options.endThreshold || currentValue >= options.endThreshold)
      && (currentGapSize <= maxGapSize)
      && (numGaps <= maxGaps)
      && (gapRatio <= maxGapRatio)) {
    //reset current location in matrix
    if (currentTrace === TRACES.DIAGONAL) {
      [i,j] = [i-1,j-1];
    } else if (currentTrace === TRACES.UP && !options.onlyDiagonals) {
      [i,j] = [i-1,j];
    } else if (currentTrace === TRACES.LEFT && !options.onlyDiagonals) {
      [i,j] = [i,j-1];
    }
    if (i >= 0 && j >= 0 && matrices.scoreMatrix[i][j] !== currentValue) {//next alignment found
      currentValue = matrices.scoreMatrix[i][j];
      currentTrace = matrices.traceMatrix[i][j];
      if (!options.onlyDiagonals || (currentTrace == TRACES.DIAGONAL &&
          //only add in strict diagonal version if it was a match
          ((i == 0 || j == 0) ? currentValue > 0
           : currentValue > matrices.scoreMatrix[i-1][j-1]))) {//first point
        pointsOnAlignment.push([i,j]);
        currentGapSize = 0;
      } else {
        if (currentGapSize == 0) numGaps++;
        currentGapSize++;
        totalGapSize++;
      }
      //TODO adjust for nondiagonals...
      gapRatio = totalGapSize/(pointsOnAlignment.length+totalGapSize);
    } else break;
  }
  //sort by first/second component
  pointsOnAlignment = _.sortBy(pointsOnAlignment, p=>p[1]);
  pointsOnAlignment = _.sortBy(pointsOnAlignment, p=>p[0]);
  //fill gaps if appropriate
  if (options.onlyDiagonals && options.fillGaps) {
    const f = _.first(pointsOnAlignment); //lowest index
    const l = _.last(pointsOnAlignment); //highest index
    pointsOnAlignment = _.zip(_.range(f[0],l[0]+1), _.range(f[1],l[1]+1));
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