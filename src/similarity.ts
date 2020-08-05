import * as math from 'mathjs';
import * as _ from 'lodash';
import { getMedian, getEmptyMatrix, toPatterns, loadOrPerformAndCache,
  createPointMatrix } from './util';
import { getPaddedArea } from './sw-structure';
import { MultiStructureResult, CacheableStructureOptions } from './structure';

export interface AffinityAlignmentResult extends MultiStructureResult {
  affinityMatrix: number[][],
  smoothedMatrix: number[][],
  segmentMatrix: number[][]
}

export interface AffinityAlignmentOptions extends CacheableStructureOptions {
  minSegmentLength?: number,
  similarityThreshold?: number,
  nLongest?: number,
  fillGaps?: boolean,
  maxGapSize?: number,
  maxGaps?: number,
  maxGapRatio?: number,
  minDistance?: number, //min distance between parallel segments: 1 == directly adjacent, 2 == gap of one
  cacheDir?: string
}

export function getCachedAffinityAlignment(points: number[][],
    options: AffinityAlignmentOptions, points2?: number[][]): AffinityAlignmentResult {
  const file = 'sw_'+getSimOptionsString(options)+'.json';
  return loadOrPerformAndCache(file,
    () => Object.assign(
      getAffinityAlignment(points, options, points2), {points2: points2}),
    options);
}

function getSimOptionsString(options: AffinityAlignmentOptions) {
  return (options.minSegmentLength ? options.minSegmentLength : '')//0 == undefined
    +'_'+ (options.similarityThreshold != null ? options.similarityThreshold : '')
    +'_'+ (options.nLongest ? options.nLongest : '')
    +'_'+ (options.maxGapSize != null ? options.maxGapSize : '')
    +'_'+ (options.maxGaps ? options.maxGaps : '')
    +'_'+ (options.maxGapRatio ? options.maxGapRatio : '')
    +'_'+ (options.minDistance ? options.minDistance : '')
}

export function getAffinityAlignment(points: number[][],
    options: AffinityAlignmentOptions, points2?: number[][]): AffinityAlignmentResult {
  points2 = points2 || points;
  let matrix = getAffinityMatrix(points.map(p => p.slice(1)),
    points2.map(p => p.slice(1)), !options.similarityThreshold);
  //remove symmetry
  const symmetric = !points2 || _.isEqual(points2, points);
  if (symmetric) matrix = matrix.map((r,i) =>
    r.map((v,j) => j > i ? v : 0));
  let smoothed = smoothDiagonals(matrix, options.maxGapSize);
  //mask smoothed matrix
  smoothed = smoothed.map(r => r.map(v =>
    v >= (options.similarityThreshold || 1) ? v : 0));
  const dias = getNonzeroDiagonalSegments(smoothed);
  const segments = reduceSegments(dias, options,
    points.length, points2.length, symmetric);
  return {
    points: points,
    points2: points2,
    patterns: toPatterns(segments, points, points2),
    affinityMatrix: matrix,
    smoothedMatrix: smoothed,
    segmentMatrix: createPointMatrix(
      _.flatten(segments), points, points2, symmetric)
  }
}

function reduceSegments(segments: [number,number][][],
    options: AffinityAlignmentOptions, numPoints1: number, numPoints2: number,
    symmetric: boolean) {
  const padding = options.minDistance ? options.minDistance-1 : 0;
  //remove short segments
  segments = segments.filter(s => s.length >= options.minSegmentLength);
  //sort, longest first
  segments = _.reverse(_.sortBy(segments, a => a.length));
  const reduced: [number, number][][] = [];
  const matrix = getEmptyMatrix(numPoints1, numPoints2);
  if (symmetric) getPaddedArea(_.range(0, numPoints1).map(i => [i,i]), padding,
    symmetric, numPoints1-1, numPoints2-1).forEach(p => matrix[p[0]][p[1]] = 1);
  //keep longest while respecting min dist
  while (segments.length > 0
      && (!options.nLongest || reduced.length < options.nLongest)) {
    const currentAlignment = segments.shift();
    const nooverlap = currentAlignment.filter(p => matrix[p[0]][p[1]] == 0);
    //add if not covered by any previous segment
    if (nooverlap.length == currentAlignment.length) {
      reduced.push(currentAlignment);
      getPaddedArea(currentAlignment, padding, symmetric, numPoints1-1,
        numPoints2-1).forEach(p => matrix[p[0]][p[1]] = 1);
    //save nonoverlapping part for later
    } else if (nooverlap.length >= options.minSegmentLength) {
      const i = segments.findIndex(a => a.length == nooverlap.length);
      segments.splice(i, 0, nooverlap);
    }
  }
  return reduced;
}

export function getNonzeroDiagonalSegments(matrix: number[][]): [number,number][][] {
  return _.flatten(getDiagonalIndexPairs(matrix).map(d =>
    d.reduce((segs, [i,j], k) => {
      if (matrix[i][j] > 0) {
        k == 0 || matrix[i-1][j-1] == 0 ? segs.push([[i,j]]) :
        _.last(segs).push([i,j])
      }
      return segs;
    }, [])))
    .filter(d => d.length > 0);
}

export function getDiagonalIndexPairs(matrix: number[][]): [number,number][][] {
  const I = matrix.length;
  const J = matrix[0].length;
  const minLength = Math.min(I, J);
  const belowMainDiagonal = _.reverse(_.range(1, I).map(d =>
    _.range(0, minLength).map(j => [j+d,j]).filter(([i,j]) => i < I && j < J)));
  const fromMainDiagonal = _.range(0, matrix[0].length).map(d =>
    _.range(0, minLength).map(i => [i,i+d]).filter(([i,j]) => i < I && j < J));
  return <[number,number][][]>belowMainDiagonal.concat(fromMainDiagonal);
}

export function getSelfSimilarityMatrix(vectors: number[][], equality?: boolean, smoothness = 0) {
  return getAffinityMatrix(vectors, vectors, equality, smoothness);
}

function getAffinityMatrix(v1: number[][], v2: number[][], equality?: boolean,
    smoothness = 0) {
  return smoothDiagonals(v1.map(v => v2.map(w =>
    equality ? (_.isEqual(v, w) ? 1 : 0) : getCosineSimilarity(v, w))),
    smoothness);
}

//median filter with median of (level*2)+1
function smoothDiagonals(matrix: number[][], level = 1) {
  return level > 0 ? matrix.map((x,i) => x.map((_y,j) =>
    getMedian(getDiagonal(matrix, [i-level, j-level], (level*2)+1)))) : matrix;
}

function getDiagonal(matrix: number[][], start: [number, number], length: number) {
  return _.range(0, length).map(k => [start[0]+k, start[1]+k])
    .filter(([i,j]) => 0 <= i && i < matrix.length && 0 <= j && j < matrix[0].length)
    .map(([i,j]) => matrix[i][j]);
}

//adds the given successor to the predecessor of the given uri in the given sequence
export function addSuccessorToPredecessorOf(uri, successor, sequence, store) {
  var index = sequence.indexOf(uri);
  if (index > 0) {
    var predecessorUri = sequence[index-1];
    store.addSuccessor(predecessorUri, successor);
  }
}

export function addSimilaritiesAbove(store, similarities, threshold) {
  for (var uri1 in similarities) {
    for (var uri2 in similarities[uri1]) {
      //console.log(similarities[uri1][uri2])
      if (similarities[uri1][uri2] > threshold) {
        store.addSimilar(uri1, uri2);
        store.addSimilar(uri2, uri1);
      }
    }
  }
}

export function addHighestSimilarities(store, similarities, count) {
  //gather all similarities in an array
  var sortedSimilarities = [];
  for (var uri1 in similarities) {
    for (var uri2 in similarities[uri1]) {
      sortedSimilarities.push([similarities[uri1][uri2], uri1, uri2]);
    }
  }
  //sort in descending order
  sortedSimilarities = sortedSimilarities.sort((a,b) => b[0] - a[0]);
  //console.log(sortedSimilarities.map(s => s[0]))
  //add highest ones to dymos
  for (var i = 0, l = Math.min(sortedSimilarities.length, count); i < l; i++) {
    var sim = sortedSimilarities[i];
    store.addSimilar(sim[1], sim[2]);
    store.addSimilar(sim[2], sim[1]);
  }
}

export function reduce(vector) {
  var unitVector = Array.apply(null, Array(vector.length)).map(Number.prototype.valueOf, 1);
  return getCosineSimilarity(vector, unitVector);
}

export function getCosineSimilarities(vectorMap) {
  var similarities = {};
  for (var uri1 in vectorMap) {
    for (var uri2 in vectorMap) {
      if (uri1 < uri2) {
        if (!similarities[uri1]) {
          similarities[uri1] = {};
        }
        similarities[uri1][uri2] = getCosineSimilarity(vectorMap[uri1], vectorMap[uri2]);
      }
    }
  }
  return similarities;
}

export function getCosineSimilarity(v1: number[], v2: number[]) {
  if (v1.length == v2.length) {
    if (v1.every(x => x == 0) && v2.every(x => x == 0)) return 1;
    const similarity = math.dot(v1, v2)/(math.norm(v1)*math.norm(v2));
    if (similarity) return similarity; //0 if one of vectors zero-vector...
  }
  return 0;
}
