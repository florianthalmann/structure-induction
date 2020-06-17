import * as _ from 'lodash';
import { modForReal, allIndexesOf, cartesianProduct } from './util';

export interface Segmentation {
  p: number, //position
  l: number, //length
  ts: number[] //translations
}

interface Tree<T> {
    [key: number]: Array<Tree<T> | T> | T;
}

/** assumes that all occurrences of segments are of the same length! */
export function inferHierarchyFromPatterns(patterns: number[][][]) {
  let segmentations = patterns.map(p => toSegmentation(p));
  //segments.forEach(s => processSegmentPair(s));
  segmentations = _.flatten(segmentations.map(s => split(s)));
  //TODO NOW BUILD HIERARCHY  
}

export function inferHierarchyFromMatrix(matrix: number[][]) {
  const possibleSegs = getAllHierarchicalSegmentations(matrix);
  const candidates = possibleSegs.map(s =>
    constructHierarchyFromSegmentations(s, matrix.length));
  candidates.map(h => console.log(JSON.stringify(h)));
  const ratings = candidates.map(rateHierarchy);
  console.log(JSON.stringify(ratings));
  console.log(JSON.stringify(segmentationsToMatrix(
    possibleSegs[ratings.indexOf(_.max(ratings))], getSize(matrix))));
  return candidates[ratings.indexOf(_.max(ratings))];
}

/** simply takes the first of possible segmentations and builds a hierarchy */
export function quicklyInferHierarchyFromMatrix(matrix: number[][]) {
  const segs = matrixToSegments(matrix).map(s => alignmentToSegmentations(s)[0]);
  return getHierarchicalSegmentation(_.flatten(segs));
}

export function keepNBestSegments(matrix: number[][], n: number): number[][] {
  const segments = matrixToSegments(matrix);
  //very reductive: simply takes first of first set of segmentations
  const segmentations = _.flatten(segments.map(s => alignmentToSegmentations(s)[0][0]));
  const best = _.reverse(_.sortBy(_.zip(segments, segmentations), z => z[1].l));
  return segmentsToMatrix(best.slice(0, n).map(z => z[0]), getSize(matrix));
}

function getAllHierarchicalSegmentations(matrix: number[][]) {
  const allSegs = matrixToSegments(matrix).map(s => alignmentToSegmentations(s));
  const prod = cartesianProduct(allSegs);
  return prod.map(segs => getHierarchicalSegmentation(_.flatten(segs)));
}

function getHierarchicalSegmentation(segmentations: Segmentation[], minLength = 2) {
  return addTransitivity(removeSegmentationOverlaps(segmentations, minLength, 1));
}

/** construction of a hierarchy from a given number of segmentations */
function constructHierarchyFromSegmentations(segmentations: Segmentation[], size: number) {
  const hierarchy: Tree<number> = _.range(0, size);
  segmentations.forEach(s => _.concat([0], s.ts).forEach(t => {
    groupAdjacentLeavesInTree(hierarchy, _.range(s.p+t, s.p+t+s.l));
  }));
  return simplifyHierarchy(hierarchy);
}

export function rateHierarchy<T>(tree: Tree<T>) {
  const lengths = getNodeLengths(tree).filter(n => n > 1);
  console.log(JSON.stringify(lengths))
  const complexity = lengths.length;
  const quality = _.mean(lengths);
  return quality*complexity;
}

function getChildrenCounts<T>(tree: Tree<T>): number[] {
  return Array.isArray(tree) ?
    [tree.length].concat(_.flatten(tree.map(t => getChildrenCounts(t)))) : [0];
}

function getNodeLengths<T>(tree: Tree<T>): number[] {
  return Array.isArray(tree) ?
    [_.flattenDeep(tree).length]
      .concat(_.flatten(tree.map(t => getNodeLengths(t)))) : [1];
}

function simplifyHierarchy<T>(hierarchy: Tree<T>) {
  if (Array.isArray(hierarchy)) {
    return hierarchy.length == 1 ? simplifyHierarchy(hierarchy[0]) :
      hierarchy.map(h => simplifyHierarchy(h))
  } else return hierarchy;
}

function groupAdjacentLeavesInTree<T>(tree: Tree<T>, leaves: T[]) {
  if (Array.isArray(tree)) {
    if (leaves.every(b => _.includes(tree, b))) {
      const index = tree.indexOf(leaves[0]);
      tree.splice(index, leaves.length, leaves);
    } else {//recur
      tree.forEach(t => groupAdjacentLeavesInTree(t, leaves));
    }
  }
}

/** overlaps have to be removed before */
function addTransitivity(segmentations: Segmentation[]) {
  segmentations.forEach((s,i) => {
    _.reverse(segmentations.slice(0,i)).forEach(t => {
      const ps = getPositions(s, t);
      if (t.p+ps[0] < s.p) {
        move(s, t.p+ps[0] - s.p);
      }
      if (ps.length > 0) {
        s.ts = _.uniq(_.sortBy(_.concat(s.ts,
          _.flatten(ps.map(p => [0].concat(t.ts).map(u => t.p+u+p-s.p))))))
            .filter(t => t != 0);
      }
    });
  });
  return segmentations;
}

/** returns positions at which s is contained in t */
function getPositions(s: Segmentation, t: Segmentation) {
  const positions = getOccurrences(s).map(so => getOccurrences(t).map(to =>
    so.every(p => _.includes(to, p)) ? so[0]-to[0] : -1));
  return _.sortBy(_.uniq(_.flatten(positions).filter(p => p >= 0)));
}

function move(s: Segmentation, delta: number) {
  s.p = s.p+delta;
  s.ts = s.ts.map(t => t-delta);
}

function getOccurrences(s: Segmentation) {
  return [s.p].concat(s.ts.map(t => s.p+t)).map(p => _.range(p, p+s.l));
}

/** removes any segmentation overlaps, starting with longest segmentation,
    adjusting shorter ones to fit within limits */
function removeSegmentationOverlaps(segments: Segmentation[], minSegLength = 2, divFactor = 1) {
  //sort by length and first translation vector
  segments = filterAndSortSegmentations(segments, minSegLength, divFactor);
  const result: Segmentation[] = [];
  while (segments.length > 0) {
    const next = segments.shift();
    result.push(next);
    const newBoundaries = _.uniq(_.flatten(
      _.concat([0], next.ts).map(t => [next.p+t, next.p+t+next.l])));
    segments = newBoundaries.reduce((segs, b) =>
      _.flatten(segs.map(s => divideAtPos(s, b))), segments);
    segments = filterAndSortSegmentations(segments, minSegLength, divFactor);
  }
  return result;
}

//sort by length and first translation vector
function filterAndSortSegmentations(segmentations: Segmentation[],
    minSegLength: number, divFactor: number) {
  segmentations = segmentations.filter(s =>
    s.l >= minSegLength && s.ts.every(t => modForReal(t, divFactor) == 0));
  return _.reverse(_.sortBy(segmentations, s => s.l));
}

function segmentationsToMatrix(segmentations: Segmentation[],
    size: [number, number]): number[][] {
  const matrix = getZeroMatrix(size);
  segmentations.forEach(s => _.range(0, s.l).forEach(i => s.ts.forEach(t => {
    matrix[s.p+i][s.p+t+i] = 1; matrix[s.p+t+i][s.p+i] = 1;
  })));
  return matrix;
}

function matrixToSegments(matrix: number[][]): number[][][] {
  let points = _.flatten(matrix.map((row,i) => row.map((val,j) => [i,j,val])))
  points = points.filter(p => p[1] > p[0] && p[2] > 0)
  points = _.sortBy(points, p => p[1]-p[0]);
  const segments = points.reduce<number[][][]>((segs, p) => {
    const prev = _.last(_.last(segs)) || [0,0,0];
    p[0]-prev[0] == 1 && p[1]-prev[1] == 1 ?
      _.last(segs).push(p.slice(0,2)) : segs.push([p.slice(0,2)]);
    return segs;
  }, []);
  return _.reverse(_.sortBy(segments, s => s.length));
}

function segmentsToMatrix(segments: number[][][], size: [number, number]): number[][] {
  const matrix = getZeroMatrix(size);
  segments.forEach(s => s.forEach(p => {
    matrix[p[0]][p[1]] = 1; matrix[p[1]][p[0]] = 1;
  }));
  return matrix;
}

function getSize(matrix: number[][]): [number, number] {
  return [matrix.length, matrix[0].length];
}

function getZeroMatrix(size: [number, number]) {
  return _.range(0, size[0]).map(_i => _.range(0, size[1]).map(_j => 0));
}

/** returns all possible partitions into segmentations for the given alignment.
  the partitions include full occurrences and initial and final residues */
function alignmentToSegmentations(a: number[][]): Segmentation[][] {
  const interval = a[0][1]-a[0][0];
  const length = Math.min(a.length, interval);
  const numCopies = Math.floor(a.length/length);
  const numSolutions = a.length > length ? modForReal(a.length, length)+1 : 1;
  const positions = a.slice(0, numSolutions).map(p => p[0]);
  const vectors = _.range(0, numCopies).map(t => ((t+1)*interval));
  const fullSeg = {p: a[0][0], l: a.length, ts: vectors};
  return positions.map(p => split(fullSeg, p-fullSeg.p));
}

function toSegmentation(pattern: number[][]): Segmentation {
  const length = _.last(pattern[0])-pattern[0][0];
  return {
    p: pattern[0][0],
    l: length,
    ts: pattern.slice(1).map(p => p[0]-pattern[0][0])
  };
}

/** offset: position relative to the beginning of the segmentation (s.p) */
function split(s: Segmentation, offset = 0): Segmentation[] {
  const segs = [];
  const ts = _.min(s.ts);
  //initial residue
  if (offset > 0) {
    const div = divide(s, offset);
    segs.push(div[0]);
    s = div[1];
  }
  //complete segmentations
  while (s.l > ts) {
    const div = divide(s, ts);
    segs.push(div[0]);
    s = div[1];
  }
  //final residue
  if (s) segs.push(s);
  return segs;
}

function divideAtPos(s: Segmentation, pos: number): Segmentation[] {
  const locs = _.reverse(_.uniq([s.p].concat(s.ts.map(t => s.p+t)).map(p =>
    p < pos && pos < p+s.l ? pos-p : -1).filter(loc => loc > -1)));
  return _.reduce(locs, (segs,l) => divide(segs[0], l).concat(segs.slice(1)), [s]);
}

/** divides the segmentation s at position loc */
function divide(s: Segmentation, loc: number): Segmentation[] {
  if (0 < loc && loc < s.l) {
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

/** infers a hierarchy BOTTOM-UP from a sequence of numbers representing types */
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