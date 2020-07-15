import * as _ from 'lodash';
import { modForReal, allIndexesOf, cartesianProduct, getEntropy } from './util';

interface Pattern {
  p: number, //position
  l: number, //length
  ts: number[], //translation vectors
  r?: number //rest
}

interface PatternGraph {
  [key: number]: number[]
}

interface Tree<T> {
    [key: number]: Array<Tree<T> | T> | T;
}

/** assumes that all occurrences of segments are of the same length! */
export function inferHierarchyFromPatternOccurrences(occs: number[][][]) {
  let patterns = occs.map(p => toPattern(p));
  //segments.forEach(s => processSegmentPair(s));
  //patterns = _.flatten(patterns.map(s => split(s)));
  //TODO NOW BUILD HIERARCHY
}

export function inferHierarchyFromMatrix2(matrix: number[][]) {
  const allPatterns = matrixToPatterns(matrix);
  console.log(allPatterns.map(p => p.length));
  console.log(allPatterns.map(p => p[0][0].l));
  const candidates = cartesianProduct(allPatterns);
  console.log(candidates.length)
  const limits = candidates.map(ps => getDistributionOfLimits(_.flatten(ps).filter(p => p.l > 1)));
  console.log(limits.length)
  limits.map(l => console.log(JSON.stringify(l)))
  const ratings = limits.map(l => getEntropy(l));
  console.log(ratings)
  /*const candidates = possibleSegs.map(s =>
    constructHierarchyFromPatterns(s, matrix.length));
  //candidates.map(h => console.log(JSON.stringify(h)));
  const ratings = candidates.map(rateHierarchy);
  console.log(JSON.stringify(ratings.map(r => _.round(r, 2))));*/
  return candidates[ratings.indexOf(_.min(ratings))];
}

export function inferHierarchyFromMatrix(matrix: number[][]) {
  const allPatterns = matrixToPatterns(matrix);
  const limits = getDistributionOfLimits(_.flatten(allPatterns[0]).filter(p => p.l > 1));
  console.log(limits)
  const best = searchForBestCombination(allPatterns);
  console.log(JSON.stringify(best))

  /*const candidates = possibleSegs.map(s =>
    constructHierarchyFromPatterns(s, matrix.length));
  //candidates.map(h => console.log(JSON.stringify(h)));
  const ratings = candidates.map(rateHierarchy);
  console.log(JSON.stringify(ratings.map(r => _.round(r, 2))));*/
  //return candidates[ratings.indexOf(_.min(ratings))];
  return best;
}

function searchForBestCombination(patterns: Pattern[][][]) {
  let currentBest = patterns.map(_p => 0);
  let currentRating = getRating(patterns, currentBest);
  //console.log(currentRating)
  while (true) {
    let newBest = currentBest;
    let newRating = currentRating;
    patterns.forEach((ps,i) => {
      const options = ps.map((_p,j) => newBest.map((k,l) => l == i ? j : k));
      const ratings = options.map(o => getRating(patterns, o));
      const min = _.min(ratings);
      if (min < newRating) {
        newBest = options[ratings.indexOf(min)];
        newRating = min;
        //console.log(min, JSON.stringify(newBest))
      }
    });
    if (newRating < currentRating) {
      currentBest = newBest;
      currentRating = newRating;
    } else break;
  }
  return currentBest.map((b,i) => patterns[i][b]);
}

function getRating(patterns: Pattern[][][], indexes: number[]) {
  const selection = _.flatten(patterns.map((p,i) => p[indexes[i]]));
  return getEntropy(getDistributionOfLimits(selection.filter(p => p.l > 1)));
}

/** simply takes the first of possible patterns and builds a hierarchy */
export function quicklyInferHierarchyFromMatrix(matrix: number[][], simplify: boolean) {
  let patterns = getFirstPatterns(matrix);
  console.log(JSON.stringify(getDistributionOfLimits(patterns)))
  if (simplify) patterns = simplifyPatterns(patterns);
  return constructHierarchyFromPatterns(patterns, matrix.length);
}

export function keepNBestSegments(matrix: number[][], n: number): number[][] {
  const segments = matrixToSegments(matrix);
  //very reductive: simply takes first of first set of patterns
  const patterns = getFirstPatterns(matrix);
  const best = _.reverse(_.sortBy(_.zip(segments, patterns), z => z[1].l));
  return segmentsToMatrix(best.slice(0, n).map(z => z[0]), getSize(matrix));
}

export function getTransitiveMatrix(matrix: number[][], simplify: boolean): number[][] {
  //very reductive: simply takes first of first set of patterns
  let patterns = getFirstPatterns(matrix);
  if (simplify) patterns = simplifyPatterns(patterns);
  return patternsToMatrix(makePatternsTransitive(patterns), getSize(matrix));
}

export function getFirstPatterns(matrix: number[][]) {
  //console.log(matrixToPatterns(matrix).map(s => s.length))
  return _.flatten(matrixToPatterns(matrix).map(s => s[0]));
}

function matrixToPatterns(matrix: number[][]) {
  return matrixToSegments(matrix).map(s => alignmentToPatterns(s));
}

export function simplifyPatterns(patterns: Pattern[], minLength = 2) {
  console.log("full", patterns.length)
  //sort by length, beginning point, and first vector
  patterns = sortPatterns(patterns).filter(p => p.l >= minLength);
  console.log(JSON.stringify(patterns))
  patterns = mergeAdjacent(patterns).filter(p => p.l >= minLength);
  console.log("merged", patterns.length)
  console.log(JSON.stringify(patterns))
  //pattern = addTransitivity(pattern);
  patterns = removeSubsegs(patterns).filter(p => p.l >= minLength);
  console.log("subsegs", patterns.length);
  console.log(JSON.stringify(patterns));

  patterns = syncMultiples(patterns).filter(p => p.l >= minLength);
  console.log("sync", patterns.length);
  console.log(JSON.stringify(patterns));

  patterns = removeMultiples(patterns).filter(p => p.l >= minLength);
  console.log("remove", patterns.length);
  console.log(JSON.stringify(patterns));

  const timeline = getDistributionOfLimits(patterns.filter(s => s.l > 1))
  console.log(JSON.stringify(timeline))

  //agreement of limits of each pattern with other limits...
  /*const comps = limits.map((ls,i) =>
    allLimits.filter(l => _.includes(ls, l)).length / allLimits.length / patterns[i].ts.length);
  console.log(JSON.stringify(comps));
  console.log(_.sum(limits[0].map(l => timeline[l])));
  console.log(_.sum(limits[0].map(l => l+1).map(l => timeline[l])));
  console.log(_.sum(limits[0].map(l => l+2).map(l => timeline[l])));
  console.log(_.sum(limits[0].map(l => l+3).map(l => timeline[l])));
  console.log(_.sum(limits[0].map(l => l+4).map(l => timeline[l])));
  console.log(_.sum(limits[0].map(l => l+5).map(l => timeline[l])));
  console.log(_.sum(limits[0].map(l => l+6).map(l => timeline[l])));
  console.log(_.sum(limits[0].map(l => l+7).map(l => timeline[l])));
  console.log(_.sum(limits[0].map(l => l+8).map(l => timeline[l])));
  console.log(JSON.stringify(limits.map(ls => _.sum(ls.map(l => timeline[l])))));*/

  //now remove pattern overlaps (ts where segs longer in other pattern...)
  //seggraph difference????
  //pattern = removeIncluded(pattern);
  return patterns;
}

function getDistributionOfLimits(patterns: Pattern[]) {
  const limits = _.flatten(patterns.map(s => getLimits(s)));
  const distribution = _.range(0, _.max(limits)+1).map(_i => 0);
  limits.forEach(l => distribution[l]++);
  return distribution;
}

function indexesOfNMax(array: number[], n: number): number[] {
  const maxes = _.reverse(_.sortBy(array.map((a,i) => [a,i]), 0))
    .filter(m => m[0] > 0); //filter out <= 0
  return _.takeWhile(maxes, (m,i) => i < n || m[0] == maxes[i-1][0])
    .map(m => m[1]);
}

//needs to be sorted from long to short
function mergeAdjacent(pattern: Pattern[]) {
  return pattern.reduce<Pattern[]>((segs,s) => {
    const merged = segs.length > 0 ? merge(_.last(segs), s) : null;
    if (merged) segs[segs.length-1] = merged;
    else segs.push(s);
    return segs;
  }, []);
}

function removeSubsegs(pattern: Pattern[]) {
  const graphs = pattern.map(s => toPatternGraph(s));
  return pattern.filter((s,i) =>
    !graphs.filter((g,j) => i != j && size(graphs[i]) < size(g))// && pattern[j].l >= s.l)
      .some(g => subGraph(graphs[i], g)));
}

function size(graph: PatternGraph) {
  return _.flatten(_.values(graph)).length;
}

/** align starting points and vectors of all patterns that are seamless multiples.
  need to be sorted from long to short */
function syncMultiples(pattern: Pattern[]) {
  const seamlesses = pattern.map(s => seamless(s));
  let adjusted = true;
  while (adjusted) {
    adjusted = false;
    pattern.forEach((s,i) => pattern.slice(0,i).forEach((t,j) => {
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
  return pattern;
}

//needs to be seamless
function moveBeginning(s: Pattern, delta: number) {
  s.p = s.p+delta;
  s.ts = _.range(1, s.ts.length+1-Math.ceil(delta/s.l)).map(i => i*s.l);
}

function removeMultiples(pattern: Pattern[]) {
  //remove patterns whose ts are a multiple of another existing pattern and
  //are covered entirely by it...
  return pattern.filter((s,i) => !pattern.slice(i+1).some(t =>
    seamless(s) && seamless(t) && multiple(s.l, t.l)
      && overlapSize(s, t) >= Math.max(s.l, t.l)
      && s.p == t.p && s.ts.every(u => _.includes(t.ts, u))
  ));
}

function seamless(s: Pattern) {
  return s.ts.map((t,i) => i == 0 ? t : t-s.ts[i-1]).every(t => t == s.l);
}

/** returns true if n is a multiple of m */
function multiple(n: number, m: number) {
  return modForReal(n, m) == 0;
}

function overlapSize(s: Pattern, t: Pattern) {
  return _.intersection(_.flatten(getOccurrences(s)),
    _.flatten(getOccurrences(t))).length;
}

/*//removes whole occurrences in s if they are fully described by t
function removeOverlaps(pattern: Pattern[]) {
  return pattern.map(s =>
    pattern.filter(t => t != s && t.l <= s.l).reduce((r,t) =>
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
export function subGraph(s: PatternGraph, t: PatternGraph) {
  return _.keys(s).every(k => subset(s[k], t[k]));
}

//can be optimized for sorted lists...
function subset<T>(s1: T[], s2: T[]) {
  return s1.every(s => _.includes(s2, s));
}

export function toPatternGraph(s: Pattern) {
  const graph: PatternGraph = {};
  const ts = [0].concat(s.ts);
  _.range(s.p, s.p+s.l).forEach(p => ts.forEach((t,i) =>
      i < ts.length-1 ? graph[p+t] = ts.slice(i+1).map(u => u+p) : null));
  return graph;
}

export function graphToPattern(s: PatternGraph): Pattern {
  const p = parseInt(_.keys(s)[0]);
  const ts = s[p].map(t => t-p);
  const l = _.takeWhile(_.keys(s), k => s[k].length == ts.length).length;
  return {p: p, l: l, ts: ts};
}

export function getEdges(matrix: number[][]) {
  const segs = getFirstPatterns(matrix);
  const result = _.range(0, matrix.length).map(_i => 0);
  segs.forEach(s =>
    [0].concat(s.ts).forEach(t => s.p+t < result.length ? result[s.p+t] = result[s.p+t]+s.l : 0));
  return result;
}

/** construction of a hierarchy from a given number of patterns */
function constructHierarchyFromPatterns(patterns: Pattern[], size: number): Tree<number> {
  patterns = makePatternsTransitive(patterns);
  const hierarchy: Tree<number> = _.range(0, size);
  patterns.forEach(s => _.concat([0], s.ts).forEach(t => {
    groupAdjacentLeavesInTree(hierarchy, _.range(s.p+t, s.p+t+s.l));
  }));
  return simplifyHierarchy(hierarchy);
}

function makePatternsTransitive(patterns: Pattern[]) {
  const noOverlaps = removePatternOverlaps(patterns);
  console.log("noov", JSON.stringify(noOverlaps));
  return addTransitivity(noOverlaps);
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

function simplifyHierarchy<T>(hierarchy: Tree<T>): Tree<T> {
  if (Array.isArray(hierarchy)) {
    return hierarchy.length == 1 ? simplifyHierarchy(hierarchy[0]) :
      <Tree<T>><any>hierarchy.map(h => simplifyHierarchy(h));
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
  shortest length */
export function addTransitivity(patterns: Pattern[]) {
  patterns.forEach((s,i) => {
    _.reverse(patterns.slice(0,i)).forEach(t => {
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
  return patterns;
}

/** returns relative positions at which s is contained in t */
function getInternalPositions(s: Pattern, t: Pattern) {
  const positions = getOccurrences(s).map(so => getOccurrences(t).map(to =>
    so.every(p => _.includes(to, p)) ? so[0]-to[0] : -1));
  return _.sortBy(_.uniq(_.flatten(positions).filter(p => p >= 0)));
}

function moveRefPoint(s: Pattern, delta: number) {
  s.p = s.p+delta;
  s.ts = s.ts.map(t => t-delta);
}

/** returns all the occurrences of a pattern as index ranges */
function getOccurrences(s: Pattern) {
  return [s.p].concat(s.ts.map(t => s.p+t)).map(p => _.range(p, p+s.l));
}

/** removes any pattern overlaps, starting with longest pattern,
    adjusting shorter ones to fit within limits */
function removePatternOverlaps(patterns: Pattern[], minSegLength = 3, minDist = 2, divFactor = 1) {
  let result: Pattern[] = [];
  patterns = filterAndSortPatterns(patterns, minSegLength, minDist, divFactor, result);
  while (patterns.length > 0) {
    const next = patterns.shift();
    console.log("results", JSON.stringify(result))
    console.log("next", next, minDistFromParents(next, result))
    result.push(next);
    result = unpack(addTransitivity(result));
    const newBoundaries = _.uniq(getLimits(next));
    patterns = newBoundaries.reduce((segs, b) =>
      _.flatten(segs.map(s => divideAtPos(s, b))), patterns);
    patterns = filterAndSortPatterns(patterns, minSegLength, minDist, divFactor, result);
  }
  return result;
}

//sort by length and first translation vector
function filterAndSortPatterns(patterns: Pattern[],
    minSegLength: number, minDist: number, divFactor: number, refPatterns: Pattern[]) {
  patterns = patterns.filter(s =>
    s.l >= minSegLength && minDistFromParents(s, refPatterns) >= minDist
      && s.ts.every(t => modForReal(t, divFactor) == 0));
  return sortPatterns(patterns, refPatterns);
}

/** sorts patterns by min(dist from parents, length), position, smallest vector */
function sortPatterns(patterns: Pattern[], parentCandidates: Pattern[] = []) {
  return _.reverse(_.sortBy(
      _.reverse(_.sortBy(
        _.sortBy(patterns,
        s => s.ts[0]),
      s => s.p)),
    s => Math.min(s.l, minDistFromParents(s, parentCandidates))));
}

export function minDistFromParents(pattern: Pattern, parentCandidates: Pattern[]) {
  const parents = parentCandidates.filter(p => containedBy(pattern, p));
  if (parents.length > 0) {
    return _.min(parents.map(p => getDistance(pattern, p))
      .concat(pattern.ts)); //also consider distance from diagonal
  }
  return Infinity;
}

/** returns true if p1 is fully contained by p2 */
export function containedBy(p1: Pattern, p2: Pattern) {
  const o1 = _.flatten(getOccurrences(p1));
  const o2 = _.flatten(getOccurrences(p2));
  return _.difference(o1, o2).length == 0;
}

export function getDistance(p1: Pattern, p2: Pattern) {
  return _.min(_.flatten(p1.ts.map(t => p2.ts.map(u => Math.abs(t-u)))));
}

export function unpack(patterns: Pattern[]): Pattern[] {
  return _.uniqBy(_.flatten(_.flatten(patterns.map(p =>
    [0].concat(p.ts).map((t,i) => p.ts.slice(i).map(u =>
      ({p: p.p+t, l: p.l, ts: [u-t]})))
  ))), p => JSON.stringify(p));
}

export function patternsToMatrix(patterns: Pattern[],
    size: [number, number]): number[][] {
  const matrix = getZeroMatrix(size);
  patterns.forEach(s => {
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

export function alignmentToPattern(a: number[][]): Pattern {
  const interval = a[0][1]-a[0][0];
  const length = Math.min(a.length, interval);
  const rest = a.length > length ? modForReal(a.length, length) : 0;
  return Object.apply(getTiles(a[0][0], a.length, interval), {r: rest});
}

/** returns all possible partitions into patterns for the given alignment.
  the partitions include full occurrences and initial and final residues */
export function alignmentToPatterns(a: number[][]): Pattern[][] {
  const interval = a[0][1]-a[0][0];
  const length = Math.min(a.length, interval);
  const numSolutions = a.length > length ? modForReal(a.length, length)+1 : 1;
  /*console.log(JSON.stringify(a));
  console.log(JSON.stringify((a.length > length ?
    _.range(0, numSolutions).map(i => getTiles(a[0][0], a.length, interval, i))
    : [[{p: a[0][0], l: a.length, ts: [interval]}]])[0]));*/
  return a.length > length ?
    _.range(0, numSolutions).map(i => getTiles(a[0][0], a.length, interval, i))
    : [[{p: a[0][0], l: length, ts: [interval]}]];
}

function getTiles(point: number, length: number, interval: number, offset = 0) {
  const segs: Pattern[] = [];
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

function toPattern(occurrences: number[][]): Pattern {
  const length = _.last(occurrences[0])-occurrences[0][0];
  return {
    p: occurrences[0][0],
    l: length,
    ts: occurrences.slice(1).map(p => p[0]-occurrences[0][0])
  };
}

/** offset: position relative to the beginning of the pattern (s.p) */
/*function splitUp(s: Pattern, offset = 0): Pattern[] {
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
    //complete patterns
    segs.push({p: s.p+offset, l: period, ts: s.ts});
    //final residue
    if (s) segs.push({p: s.l-_.last()});
    return segs;
  }
}*/

function divideAtPos(s: Pattern, pos: number): Pattern[] {
  const locs = _.reverse(_.uniq([s.p].concat(s.ts.map(t => s.p+t)).map(p =>
    p < pos && pos < p+s.l ? pos-p : -1).filter(loc => loc > -1)));
  return _.reduce(locs, (segs,l) => divide(segs[0], l).concat(segs.slice(1)), [s]);
}

/** divides the pattern s at position loc */
function divide(s: Pattern, loc: number): Pattern[] {
  if (0 < loc && loc < s.l) {
    return [{p:s.p, l:loc, ts:s.ts}, {p:s.p+loc, l:s.l-loc, ts:s.ts}];
  }
  return [s];
}

function merge(s1: Pattern, s2: Pattern): Pattern {
  if (s1.l == s2.l && commonPoint(s1, s2)) {
    const p = _.min([s1.p, s2.p]);
    const ts = _.sortBy(_.uniq(_.flatten([s1, s2].map(s => s.ts.map(t => t+s.p-p)))));
    //if (ts.every((t,i) => i == 0 || t-ts[i-1] >= s1.l)) {
      return {
        p: p,
        l: s1.l,
        ts: ts
      }
    //}
  }
  //maybe also try id lengths are different! (as in old code...)
  /*let minL = Math.min(s1.l, s2.l);
  let s1div = divide(s1, minL);
  let s2div = divide(s2, minL);*/
}

function commonPoint(s1: Pattern, s2: Pattern) {
  return _.intersection(getPoints(s1), getPoints(s2)).length > 0;
}

function getLimits(s: Pattern) {
  return _.flatten(getPoints(s).map(p => [p, p+s.l]));
}

/** returns all the points at which occurrences of s begin */
function getPoints(s: Pattern) {
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

function replaceInTree(tree: any[], subtree: any, replacement: any) {
  if (!tree.length) return tree;
  return tree.map(n => _.isEqual(n, subtree) ? replacement
    : replaceInTree(n, subtree, replacement));
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
