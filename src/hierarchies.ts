import * as _ from 'lodash';
import { modForReal, allIndexesOf, cartesianProduct } from './util';

export interface Segmentation {
  p: number, //position
  l: number, //length
  ts: number[] //translations
}

interface SegGraph {
  [key: number]: number[]
}

interface Tree<T> {
    [key: number]: Array<Tree<T> | T> | T;
}

/** assumes that all occurrences of segments are of the same length! */
export function inferHierarchyFromPatterns(patterns: number[][][]) {
  let segmentations = patterns.map(p => toSegmentation(p));
  //segments.forEach(s => processSegmentPair(s));
  //segmentations = _.flatten(segmentations.map(s => split(s)));
  //TODO NOW BUILD HIERARCHY  
}

export function inferHierarchyFromMatrix(matrix: number[][]) {
  const possibleSegs = getAllHierarchicalSegmentations(matrix);
  const candidates = possibleSegs.map(s =>
    constructHierarchyFromSegmentations(s, matrix.length));
  //candidates.map(h => console.log(JSON.stringify(h)));
  const ratings = candidates.map(rateHierarchy);
  console.log(JSON.stringify(ratings.map(r => _.round(r, 2))));
  /*console.log(JSON.stringify(segmentationsToMatrix(
    possibleSegs[ratings.indexOf(_.max(ratings))], getSize(matrix))));*/
  return candidates[ratings.indexOf(_.max(ratings))];
}

/** simply takes the first of possible segmentations and builds a hierarchy */
export function quicklyInferHierarchyFromMatrix(matrix: number[][]) {
  const seg = getHierarchicalSegmentation(getFirstSegmentations(matrix));
  return constructHierarchyFromSegmentations(seg, matrix.length);
}

export function keepNBestSegments(matrix: number[][], n: number): number[][] {
  const segments = matrixToSegments(matrix);
  //very reductive: simply takes first of first set of segmentations
  const segmentations = getFirstSegmentations(matrix);
  const best = _.reverse(_.sortBy(_.zip(segments, segmentations), z => z[1].l));
  return segmentsToMatrix(best.slice(0, n).map(z => z[0]), getSize(matrix));
}

export function cleanUpMatrix(matrix: number[][]): number[][] {
  //very reductive: simply takes first of first set of segmentations
  const segs = getHierarchicalSegmentation(getFirstSegmentations(matrix));
  return segmentationsToMatrix(segs, getSize(matrix));
}

function getAllHierarchicalSegmentations(matrix: number[][]) {
  const allSegs = matrixToSegmentations(matrix);
  const prod = cartesianProduct(allSegs);
  return prod.map(segs => getHierarchicalSegmentation(_.flatten(segs)));
}

export function getFirstSegmentations(matrix: number[][]) {
  return simplifySegmentation(_.flatten(matrixToSegmentations(matrix).map(s => s[0])));
}

function matrixToSegmentations(matrix: number[][]) {
  return matrixToSegments(matrix).map(s => alignmentToSegmentations(s));
}

export function simplifySegmentation(segmentation: Segmentation[]) {
  console.log("full", segmentation.length)
  segmentation = _.reverse(_.sortBy(segmentation, s => s.l));
  console.log(JSON.stringify(segmentation))
  segmentation = mergeAdjacent(segmentation);
  console.log("merged", segmentation.length)
  console.log(JSON.stringify(segmentation))
  //segmentation = addTransitivity(segmentation);
  segmentation = removeSubsegs(segmentation);
  console.log("subsegs", segmentation.length);
  console.log(JSON.stringify(segmentation));
  
  segmentation = syncMultiples(segmentation);
  console.log("sync", segmentation.length);
  console.log(JSON.stringify(segmentation));
  
  segmentation = removeMultiples(segmentation);
  console.log("remove", segmentation.length);
  console.log(JSON.stringify(segmentation));
  
  //now remove pattern overlaps (ts where segs longer in other pattern...)
  //seggraph difference????
  //segmentation = removeIncluded(segmentation);
  return segmentation;
}

//needs to be sorted from long to short
function mergeAdjacent(segmentation: Segmentation[]) {
  return segmentation.reduce<Segmentation[]>((segs,s) => {
    const merged = segs.length > 0 ? merge(_.last(segs), s) : null;
    if (merged) segs[segs.length-1] = merged;
    else segs.push(s);
    return segs;
  }, []);
}

function removeSubsegs(segmentation: Segmentation[]) {
  const graphs = segmentation.map(s => toSegGraph(s));
  return segmentation.filter((s,i) =>
    !graphs.filter((g,j) => i != j && size(graphs[i]) < size(g))// && segmentation[j].l >= s.l)
      .some(g => subGraph(graphs[i], g)));
}

function size(graph: SegGraph) {
  return _.flatten(_.values(graph)).length;
}

/** align starting points and vectors of all patterns that are seamless multiples.
  need to be sorted from long to short */
function syncMultiples(segmentation: Segmentation[]) {
  const seamlesses = segmentation.map(s => seamless(s));
  let adjusted = true;
  while (adjusted) {
    adjusted = false;
    segmentation.forEach((s,i) => segmentation.slice(0,i).forEach((t,j) => {
      if (seamlesses[i] && seamlesses[j]
        && multiple(t.l, s.l)
        && overlapSize(s, t) >= Math.max(s.l, t.l)
        && (s.p != t.p || t.ts.length+1 != Math.floor((s.ts.length+1)/(t.l/s.l)))
          ) {
        //adjust beginnings
        if (s.p < t.p) moveBeginning(t, s.p-t.p);
        if (t.p < s.p) moveBeginning(s, t.p-s.p);
        //adjust vectors to cover same range
        //console.log((t.ts.length+1), Math.floor((s.ts.length+1)/(t.l/s.l)))
        const factor = t.l / s.l;
        const copies = Math.max((t.ts.length+1)*factor, s.ts.length+1);
        //console.log(copies, factor)
        t.ts = _.range(1, Math.floor(copies/factor)).map(i => t.l*i);
        s.ts = _.range(1, copies).map(i => s.l*i);
        adjusted = true;
      }
    }));
  }
  return segmentation;
}

//needs to be seamless
function moveBeginning(s: Segmentation, delta: number) {
  s.p = s.p+delta;
  s.ts = _.range(1, s.ts.length+1-Math.ceil(delta/s.l)).map(i => i*s.l);
}

function removeMultiples(segmentation: Segmentation[]) {
  //remove patterns whose ts are a multiple of another existing pattern and
  //are covered entirely by it...
  return segmentation.filter((s,i) => !segmentation.slice(i+1).some(t =>
    seamless(s) && seamless(t) && multiple(s.l, t.l)
      && overlapSize(s, t) >= Math.max(s.l, t.l)
      && s.p == t.p && s.ts.every(u => _.includes(t.ts, u))
  ));
}

function seamless(s: Segmentation) {
  return s.ts.map((t,i) => i == 0 ? t : t-s.ts[i-1]).every(t => t == s.l);
}

/** returns true if n is a multiple of m */
function multiple(n: number, m: number) {
  return modForReal(n, m) == 0;
}

function overlapSize(s: Segmentation, t: Segmentation) {
  return _.intersection(_.flatten(getOccurrences(s)),
    _.flatten(getOccurrences(t))).length;
}

/*//removes whole occurrences in s if they are fully described by t
function removeOverlaps(segmentation: Segmentation[]) {
  return segmentation.map(s =>
    segmentation.filter(t => t != s && t.l <= s.l).reduce((r,t) =>
      difference(r, t)
    , s));
}

export function difference(s: SegGraph, t: SegGraph) {
  s = _.cloneDeep(s);
  _.keys(t).forEach(k => { if (s[k]) s[k] = _.difference(s[k], t[k]) });
  return cleanUp(s);
}

function cleanUp(s: SegGraph) {
  _.keys(s).forEach(k => { if (s[k].length == 0) delete s[k] });
  const firstImage: number[] = [];
  const origin = _.takeWhile(_.keys(s), k =>
    !subset(s[k], firstImage) ? firstImage.push(...s[k]) : false);
  console.log(JSON.stringify(firstImage.length))
  console.log(JSON.stringify(origin.length))
  console.log(JSON.stringify(origin.map(o => s[o])))
  const reached = origin.concat(_.flatten(origin.map(o => s[o])));
  _.difference(_.keys(s), reached).forEach(k => delete s[k] );
  return s;
}*/

//all these functions can be optimized due to the lists being sorted...
export function subGraph(s: SegGraph, t: SegGraph) {
  return _.keys(s).every(k => subset(s[k], t[k]));
}

//can be optimized for sorted lists...
function subset<T>(s1: T[], s2: T[]) {
  return s1.every(s => _.includes(s2, s));
}

export function toSegGraph(s: Segmentation) {
  const graph: SegGraph = {};
  const ts = [0].concat(s.ts);
  _.range(s.p, s.p+s.l).forEach(p => ts.forEach((t,i) =>
      i < ts.length-1 ? graph[p+t] = ts.slice(i+1).map(u => u+p) : null));
  return graph;
}

export function toSeg(s: SegGraph): Segmentation {
  const p = parseInt(_.keys(s)[0]);
  const ts = s[p].map(t => t-p);
  const l = _.takeWhile(_.keys(s), k => s[k].length == ts.length).length;
  return {p: p, l: l, ts: ts};
}

export function getEdges(matrix: number[][]) {
  const segs = getFirstSegmentations(matrix);
  const result = _.range(0, matrix.length).map(_i => 0);
  segs.forEach(s =>
    [0].concat(s.ts).forEach(t => s.p+t < result.length ? result[s.p+t] = result[s.p+t]+s.l : 0));
  return result;
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
  //console.log("hierarchy lengths", JSON.stringify(lengths))
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

/** overlaps have to be removed before, and need to be sorted from longest to
  shortest interval */
export function addTransitivity(segmentations: Segmentation[]) {
  segmentations.forEach((s,i) => {
    _.reverse(segmentations.slice(0,i)).forEach(t => {
      const ps = getInternalPositions(s, t);
      if (ps.length > 0) {
        //move ref point of child pattern to first occurrence
        if (t.p+ps[0] < s.p) {
          moveRefPoint(s, t.p+ps[0] - s.p);
        }
        //update translation vectors
        s.ts = _.uniq(_.sortBy(_.concat(s.ts,
          _.flatten(ps.map(p => getPoints(t).map(u => u+p-s.p))))))
            .filter(t => t != 0);
      }
    });
  });
  return segmentations;
}

/** returns relative positions at which s is contained in t */
function getInternalPositions(s: Segmentation, t: Segmentation) {
  const positions = getOccurrences(s).map(so => getOccurrences(t).map(to =>
    so.every(p => _.includes(to, p)) ? so[0]-to[0] : -1));
  return _.sortBy(_.uniq(_.flatten(positions).filter(p => p >= 0)));
}

function moveRefPoint(s: Segmentation, delta: number) {
  s.p = s.p+delta;
  s.ts = s.ts.map(t => t-delta);
}

/** returns all the occurrences of a segmentation as index ranges */
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
  segmentations.forEach(s => {
    const occs = [0].concat(s.ts);
    _.range(0, s.l).forEach(i => occs.forEach(t => occs.forEach(u => {
      if (t != u) {
        matrix[s.p+t+i][s.p+u+i] = 1; matrix[s.p+u+i][s.p+t+i] = 1;
      }
    })));
  });
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
export function alignmentToSegmentations(a: number[][]): Segmentation[][] {
  const interval = a[0][1]-a[0][0];
  const length = Math.min(a.length, interval);
  const numSolutions = a.length > length ? modForReal(a.length, length)+1 : 1;
  /*console.log(JSON.stringify(a));
  console.log(JSON.stringify((a.length > length ?
    _.range(0, numSolutions).map(i => getTiles(a[0][0], a.length, interval, i))
    : [[{p: a[0][0], l: a.length, ts: [interval]}]])[0]));*/
  return a.length > length ?
    _.range(0, numSolutions).map(i => getTiles(a[0][0], a.length, interval, i))
    : [[{p: a[0][0], l: a.length, ts: [interval]}]];
}

function getTiles(point: number, length: number, interval: number, offset = 0) {
  const segs: Segmentation[] = [];
  //initial residue
  if (offset > 0) {
    segs.push({p: point, l: offset, ts: [interval]});
  }
  //main tiles
  const remainingLength = length-offset;
  const numCopies = Math.floor(remainingLength/interval);
  const vectors = _.range(1, numCopies+1).map(i => i*interval);
  if (numCopies > 0) {
    segs.push({p: point+offset, l: interval, ts: vectors});
  }
  //final residue
  const rest = modForReal(remainingLength, interval);
  if (rest > 0) {
    segs.push({p: point+offset+_.last(vectors), l: rest, ts: [interval]});
  }
  return segs;
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
/*function splitUp(s: Segmentation, offset = 0): Segmentation[] {
  const period = _.min(s.ts);
  const regular = s.ts.every(t => multiple(t, period));
  if (regular && offset < ) {
    console.log(s)
    const segs = [];
    //initial residue
    if (offset > 0) {
      segs.push({p: s.p, l: offset, ts: s.ts[0]});
      s = {p: s.p+offset, l: s.l-offset, ts: s.ts};
    }
    //complete segmentations
    segs.push({p: s.p+offset, l: period, ts: s.ts});
    //final residue
    if (s) segs.push({p: s.l-_.last()});
    return segs;
  }
}*/

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

function merge(s1: Segmentation, s2: Segmentation): Segmentation {
  if (s1.l == s2.l && commonPoint(s1, s2)) {
    const p = _.min([s1.p, s2.p]);
    return {
      p: p,
      l: s1.l,
      ts: _.sortBy(_.uniq(_.flatten([s1, s2].map(s => s.ts.map(t => t+s.p-p)))))
    }
  }
  //maybe also try id lengths are different! (as in old code...)
  /*let minL = Math.min(s1.l, s2.l);
  let s1div = divide(s1, minL);
  let s2div = divide(s2, minL);*/
}

function commonPoint(s1: Segmentation, s2: Segmentation) {
  return _.intersection(getPoints(s1), getPoints(s2)).length > 0;
}

/** returns all the points at which occurrences of s begin */
function getPoints(s: Segmentation) {
  return [s.p].concat(s.ts.map(t => s.p+t));
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