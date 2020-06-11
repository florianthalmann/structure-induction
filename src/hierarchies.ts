import * as _ from 'lodash';
import { modForReal, allIndexesOf } from './util';

export interface Segmentation {
  p: number, //position
  l: number, //length
  ts: number[] //translations
}

/** assumes that all occurrences of segments are of the same length! */
export function inferHierarchyFromPatterns(patterns: number[][][]) {
  let segments = patternsToSegmentations(patterns);
  //segments.forEach(s => processSegmentPair(s));
  segments = removeInnerOverlaps(segments);
  //TODO NOW BUILD HIERARCHY
  
}

export function removeAlignmentMatrixOverlaps(matrix: number[][]) {
  const size: [number, number] = [matrix.length, matrix[0].length];
  const segmentations = matrixToSegmentations(matrix);
  const hierarchy = removeSegmentationOverlaps(segmentations);
  return segmentationsToMatrix(hierarchy, size);
}

/** removes any segmentation overlaps, starting with longest segmentation */
function removeSegmentationOverlaps(segments: Segmentation[], minSegLength = 4, divFactor = 2) {
  //sort by length and first translation vector
  segments = filterAndSortSegmentations(segments, minSegLength, divFactor);
  const result: Segmentation[] = [];
  while (segments.length > 0) {
    const next = segments.shift();
    result.push(next);
    const newBorders = _.uniq(_.flatten(
      [next.p].concat(next.ts.map(t => next.p+t)).map(t => [t, t+next.l])));
    segments = newBorders.reduce((segs, b) =>
      _.flatten(segs.map(s => divideAtPos(s, b))), segments);
    segments = filterAndSortSegmentations(segments, minSegLength, divFactor);
  }
  return result;
}

/** infers a hierarchy from a sequence of numbers representing types */
export function inferHierarchyFromTypeSequence(typeSequence: number[],
    unequalPairsOnly: boolean, log?: boolean) {
  //generate new types by merging into binary tree
  const newTypes = new Map<number, number[]>();
  let currentSequence = _.clone(typeSequence);
  let currentIndex = _.max(typeSequence)+1;
  let currentPair = getMostCommonPair(currentSequence, unequalPairsOnly);
  
  while (currentPair != null) {
    currentSequence = currentSequence.reduce<number[]>((s,t) =>
      s.length > 0 && _.isEqual([_.last(s), t], currentPair) ?
      _.concat(_.initial(s), currentIndex)
      : _.concat(s, t), []);
    const otherPreviousTypes = _.difference([...newTypes.values()],
      [newTypes.get(currentPair[0]), newTypes.get(currentPair[1])]);
    //console.log(JSON.stringify(currentSequence));
    /*console.log(newTypes.get(currentPair[0]), newTypes.get(currentPair[1]),
      currentPair.every(u => !_.includes(currentSequence, u)),
        currentPair.every(u => !_.includes(_.flatten(otherPreviousTypes), u)))*/
    //amend type if possible
    const firstNew = newTypes.get(currentPair[0]);
    const secondNew = newTypes.get(currentPair[1]);
    const occursPreviously = (t: number) => _.includes(currentSequence, t)
      || _.includes(_.flatten(otherPreviousTypes), t);
    const firstOccursInType = firstNew && occursPreviously(currentPair[0]);
    const secondOccursInType = secondNew && occursPreviously(currentPair[1]);
    if ((firstNew || secondNew) && !firstOccursInType && !secondOccursInType) {
      let operation: 'concat' | 'push' | 'unshift';
      if (firstNew && secondNew) {
        //check if first/second type contain each other
        operation = _.intersection(firstNew, currentPair).length > 0 ? 'push'
          : _.intersection(secondNew, currentPair).length > 0 ? 'unshift'
          : 'concat';
      } else {
        operation = firstNew ? 'push' : 'unshift';
      }
      if (operation === 'concat') {
        newTypes.set(currentIndex, _.concat(firstNew, secondNew));
        newTypes.delete(currentPair[0]);
        newTypes.delete(currentPair[1]);
        if (log) console.log(currentIndex, ': concat', JSON.stringify(newTypes.get(currentIndex)));
        //currentSequence = currentSequence.map(s => s === currentIndex ? currentPair[0] : s);
      } else if (operation === 'push') {
        newTypes.set(currentIndex, _.concat(firstNew, currentPair[1]));
        newTypes.delete(currentPair[0]);
        if (log) console.log(currentIndex, ': push', JSON.stringify(newTypes.get(currentIndex)));
        //currentSequence = currentSequence.map(s => s === currentIndex ? currentPair[0] : s);
      } else {
        newTypes.set(currentIndex, _.concat([currentPair[0]], secondNew));
        newTypes.delete(currentPair[1]);
        if (log) console.log(currentIndex, ': unshift', JSON.stringify(newTypes.get(currentIndex)));
        //currentSequence = currentSequence.map(s => s === currentIndex ? currentPair[1] : s);
      }
    //else add a new type
    } else {
      newTypes.set(currentIndex, currentPair);
      if (log) console.log(currentIndex, ':', JSON.stringify(newTypes.get(currentIndex)));
    }
    if (log) console.log(JSON.stringify(currentSequence));
    currentPair = getMostCommonPair(currentSequence, unequalPairsOnly);
    currentIndex++;
  }
  
  //combine types that only occur in one context
  _.reverse(_.sortBy([...newTypes.keys()])).forEach(t => {
    const parents = [...newTypes.keys()]
      .filter(n => _.includes(_.flattenDeep(newTypes.get(n)), t));
    const occs = _.flattenDeep(_.concat([...newTypes.values()], currentSequence))
      .reduce((c: number,u)=>u==t?c+1:c, 0);
    if (parents.length == 1 && occs <= 1) {
      newTypes.set(parents[0],
        replaceInTree(newTypes.get(parents[0]), t, newTypes.get(t)));
      newTypes.delete(t);
    }
  });
  
  //now flatten all types
  [...newTypes.keys()].forEach(t =>
    newTypes.set(t, _.flattenDeep(newTypes.get(t))));
  
  //create hierarchy
  let hierarchy: any[] = _.clone(currentSequence);
  if (log) console.log(_.reverse(_.sortBy([...newTypes.keys()])))
  
  hierarchy = replaceTypesRecursively(hierarchy, newTypes);
  
  //print types and occurrences
  _.reverse(_.sortBy([...newTypes.keys()])).forEach(t => {
    const seq = JSON.stringify(replaceTypesRecursively([t], newTypes)[0]);
    const occs = JSON.stringify(hierarchy).split(seq).length-1;
    if (occs && log) console.log(t, occs, seq);
  });
  
  if (log) console.log(JSON.stringify(hierarchy));
  return hierarchy;
}

function replaceTypesRecursively(hierarchy: any[], types: Map<number,number[]>) {
  hierarchy = _.cloneDeep(hierarchy);
  _.reverse(_.sortBy([...types.keys()])).forEach(t =>
    hierarchy = replaceInTree(hierarchy, t, types.get(t)));
  return hierarchy;
}

function replaceInTree(tree: any[], pattern: any, replacement: any) {
  if (!tree.length) return tree;
  return tree.map(n => _.isEqual(n, pattern) ? replacement
    : replaceInTree(n, pattern, replacement));
}

function getMostCommonPair<T>(array: T[], unequalOnly = false): [T, T] {
  let pairs = array.map<[T, T]>((a,i) =>
    i > 0 ? [array[i-1], a] : null).filter(a => a).map(p => JSON.stringify(p));
  let uniq = _.uniq(pairs);
  if (unequalOnly) uniq = uniq.filter(p =>
    {const q: [T,T] = JSON.parse(p); return q[0] != q[1]});
  const indexes = uniq.map(u => allIndexesOf(pairs, u));
  const disjunct = indexes.map(u =>
    u.reduce<number[]>((ii,i) => i == _.last(ii)+1 ? ii : _.concat(ii, i), []));
  const freqs = disjunct.map(d => d.length);
  //console.log(JSON.stringify(_.reverse(_.sortBy(_.zip(uniq, freqs), p => p[1])).slice(0,5)))
  const maxFreq = _.max(freqs);
  if (maxFreq > 1)
    return JSON.parse(uniq[freqs.indexOf(maxFreq)]);
}

function filterAndSortSegmentations(segmentations: Segmentation[],
    minSegLength: number, divFactor: number) {
  segmentations = segmentations.filter(s =>
    s.l >= minSegLength && s.ts.every(t => modForReal(t, divFactor) == 0));
  return _.reverse(_.sortBy(segmentations, s => s.l));
}

function patternsToSegmentations(patterns: number[][][]): Segmentation[] {
  return patterns.map(p => toSegmentation(p));
}

function matrixToSegmentations(matrix: number[][]): Segmentation[] {
  let points = _.flatten(matrix.map((row,i) => row.map((val,j) => [i,j,val])))
  points = points.filter(p => p[1] > p[0] && p[2] > 0)
  points = _.sortBy(points, p => p[1]-p[0]);
  let segments = points.reduce<number[][][]>((segs, p) => {
    const prev = _.last(_.last(segs)) || [0,0,0];
    p[0]-prev[0] == 1 && p[1]-prev[1] == 1 ?
      _.last(segs).push(p.slice(0,2)) : segs.push([p.slice(0,2)]);
    return segs;
  }, []);
  segments = _.reverse(_.sortBy(segments, s => s.length));
  return segments.map(s => alignmentToSegmentation(s));
}

function segmentationsToMatrix(segmentations: Segmentation[], size: [number, number]): number[][] {
  const matrix = _.range(0, size[0]).map(_i => _.range(0, size[1]).map(_j => 0));
  segmentations.forEach(s => _.range(0, s.l).forEach(i => s.ts.forEach(t => {
    matrix[s.p+i][s.p+t+i] = 1; matrix[s.p+t+i][s.p+i] = 1;
  })));
  return matrix;
}

//only keeps full occurrences TODO split off incomplete occurrences
function alignmentToSegmentation(a: number[][]): Segmentation {
  const position = a[0][0];
  const interval = a[0][1]-a[0][0];
  const length = Math.min(a.length, interval);
  const numCopies = Math.floor(a.length/length);
  const vectors = _.range(0, numCopies).map(t => ((t+1)*interval));
  return {p: position, l: length, ts: vectors};
}

/*function patternToSegments(segmentPair: number[][]) {
  let newSegments = [toSegmentation(segmentPair)];
  newSegments = processOverlaps(newSegments);
  segmentations.push();
}*/

function updateSegmentations() {
  //processOverlaps();
  //mergePatterns();
}

function toSegmentation(pattern: number[][]): Segmentation {
  const length = _.last(pattern[0])-pattern[0][0];
  return {
    p: pattern[0][0],
    l: length,
    ts: pattern.slice(1).map(p => p[0]-pattern[0][0])
  };
}

function removeInnerOverlaps(segmentations: Segmentation[]): Segmentation[] {
  return _.flatten(segmentations.map(s => split(s)));
}

function split(s: Segmentation): Segmentation[] {
  const segs = [];
  let ts = _.min(s.ts);
  while (s.l > ts) {
    const div = divide(s, ts);
    segs.push(div[0]);
    s = div[1];
  }
  segs.push(s);
  return segs;
}

function divideAtPos(s: Segmentation, pos: number): Segmentation[] {
  const loc = [s.p].concat(s.ts.map(t => s.p+t)).map(p =>
    p < pos && pos < p+s.l-1 ? pos-p : -1).filter(loc => loc > -1);
  return loc.length > 0 ? divide(s, loc[0]) : [s];
}

/** divides the segmentation s at position loc */
function divide(s: Segmentation, loc: number): Segmentation[] {
  if (0 < loc && loc < s.l-1) {
    return [{p:s.p, l:loc, ts:s.ts}, {p:s.p+loc, l:s.l-loc, ts:s.ts}];
  }
  return [s];
}

function merge(s1: Segmentation, s2: Segmentation): Segmentation[] {
  if (s1.p == s2.p) {
    let minL = Math.min(s1.l, s2.l);
    let s1div = divide(s1, minL);
    let s2div = divide(s2, minL);
    return [s1div[0]]
  }
}