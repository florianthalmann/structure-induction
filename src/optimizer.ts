import * as _ from 'lodash';
import { indexOfMax, compareArrays } from 'arrayutils';
import { SiatecResult, SiatecPattern, Point, Vector } from './siatec';
import { CosiatecHeuristic } from './heuristics';

export enum OPTIMIZATION {
  MINIMIZE,
  DIVIDE,
  PARTITION
}

export function minLength(input: SiatecResult, minLength: number): SiatecResult {
  return {
    points: input.points,
    patterns: input.patterns.filter(p => p.points.length >= minLength),
    minPatternLength: minLength
  }
}

export function minimize(input: SiatecResult, heuristic: CosiatecHeuristic, dimension: number, minLength?: number): SiatecResult {
  const patterns = input.patterns.map(p =>
    minimizePattern(p, input.points, dimension, heuristic, minLength));
  return { points: input.points, patterns: patterns, minPatternLength: minLength };
}

export function divide(input: SiatecResult, heuristic: CosiatecHeuristic, dimension: number, minLength?: number): SiatecResult {
  let patterns = _.flatten<SiatecPattern>(input.patterns.map(p =>
    dividePattern(p, input.points, dimension, heuristic, minLength)));
  patterns = unitePatterns(patterns);
  return { points: input.points, patterns: patterns, minPatternLength: minLength };
}

export function partition(input: SiatecResult, heuristic: CosiatecHeuristic, dimension: number, minLength?: number): SiatecResult {
  let patterns = _.flatten<SiatecPattern>(input.patterns.map(p =>
    partitionPattern(p, input.points, dimension, heuristic, minLength)));
  patterns = unitePatterns(patterns);
  return { points: input.points, patterns: patterns, minPatternLength: minLength };
}

function minimizePattern(pattern: SiatecPattern, allPoints: Point[], dimension: number, heuristic: CosiatecHeuristic, minLength = 1): SiatecPattern {
  if (pattern.points.length > minLength) {
    const points = cloneAndSortPoints(pattern, dimension);
    if (points.length > minLength) {
      //all possible connected subpatterns
      const subPatterns = _.flatten<SiatecPattern>(points.map((_,i) =>
        points.slice(i).map((_,j) => points.length-j - i >= minLength ? //check min length
            newPattern(points.slice(i, points.length-j), pattern.vectors) : null
        )))
        //filter for defined ones
        .filter(p => p);
      const heuristics = subPatterns.map(p => heuristic(p, allPoints));
      return subPatterns[indexOfMax(heuristics)];
    }
  }
  return pattern;
}

export function dividePattern(pattern: SiatecPattern, allPoints: Point[], dimension: number, heuristic: CosiatecHeuristic, minLength = 1): SiatecPattern[] {
  const cloned = newPattern(cloneAndSortPoints(pattern, dimension), pattern.vectors);
  return recursiveDividePattern(cloned, allPoints, dimension, heuristic, minLength);
} 

function recursiveDividePattern(pattern: SiatecPattern, allPoints: Point[], dimension: number, heuristic: CosiatecHeuristic, minLength: number): SiatecPattern[] {
  const currentHeuristicValue = heuristic(pattern, allPoints);
  if (pattern.points.length > minLength) {
    const patternPairs = pattern.points.map((_,i) =>
      //check if both segments at least minLength
      pattern.points.length - i >= minLength && i >= minLength ?
      [newPattern(pattern.points.slice(0,i), pattern.vectors),
        newPattern(pattern.points.slice(i), pattern.vectors)] : null)
      //filter for defined ones
      .filter(p => p);
    if (patternPairs.length > 0) {
      const heuristics = patternPairs.map(ps => ps.map(p => heuristic(p, allPoints)));
      const maxes = heuristics.map(_.max);
      const index: number = indexOfMax(maxes);
      if (maxes[index] > currentHeuristicValue) {
        return recursiveDividePattern(patternPairs[index][0], allPoints, dimension, heuristic, minLength)
          .concat(recursiveDividePattern(patternPairs[index][1], allPoints, dimension, heuristic, minLength));
      }
    }
  }
  return [pattern];
}

/** partitions the given pattern along the given dimension */
export function partitionPattern(pattern: SiatecPattern, allPoints: Point[], dimension: number, heuristic: CosiatecHeuristic, minLength = 1): SiatecPattern[] {
  const points = cloneAndSortPoints(pattern, dimension);
  if (pattern.vectors.length > 1 && points.length > minLength) {
    const vals = pattern.vectors.map(v => v[dimension]);
    const dists = _.flatten(vals.map((v,i) =>
      vals.filter((_,j) => j>i).map(w => Math.abs(v-w))));
    const maxLength = _.min(dists);
    const min = points[0][dimension];
    const max = _.last(points)[dimension];
    const patternLength = max-min;
    if (patternLength >= maxLength && patternLength >= minLength) {
      const partitions = _.range(0, maxLength).map(offset =>
        points.reduce<number[][][]>((result,p) => {
          const currentPartition = result.length;
          if (_.last(result).length && p[dimension] >= min+(currentPartition*maxLength)-offset) {
            result.push([p]);
          } else {
            _.last(result).push(p);
          }
          return result;
        }, [[]]));
      if (partitions.length > 0) {
        const patterns = partitions.map(ps => ps.map(p => newPattern(p, pattern.vectors)));
        const heuristics = patterns.map(ps => ps.map(p => heuristic(p, allPoints)));
        const maxes = heuristics.map(_.max);
        const i = indexOfMax(maxes);
        const numMaxes = maxes.reduce((n,m) => n + (m == maxes[i] ? 1 : 0), 0);
        //return the partition with the highest max heuristic,
        //and with the highest average if there are several ones
        let bestPartition = numMaxes == 1 ? patterns[i] : patterns[indexOfMax(heuristics.map(_.mean))];
        bestPartition = bestPartition.filter(p => p.points.length >= minLength);
        //unite patterns with identical point sets
        return unitePatterns(bestPartition);
      }
    }
  }
  return [pattern];
}

export function unitePatterns(patterns: SiatecPattern[]): SiatecPattern[] {
  const norms = patterns.map(p => toNormalForm(p.points));
  const grouped = _.groupBy(norms, n => JSON.stringify(n));
  return _.values(grouped).map(g => combine(g.map(n =>
      patterns[norms.indexOf(n)])));
}

function combine(patterns: SiatecPattern[]): SiatecPattern {
  while (patterns.length > 1) {
    const distance = _.zipWith(patterns[1].points[0],
      patterns[0].points[0], _.subtract);
    patterns[0].vectors = concatUniqAndSort(patterns[0].vectors, 
      patterns[1].vectors.map(v => _.zipWith(v, distance, _.add)));
    patterns[0].occurrences = concatUniqAndSort(patterns[0].occurrences,
      patterns[1].occurrences);
    patterns.splice(1, 1);
  }
  return patterns[0];
}

function concatUniqAndSort<T>(points: T[][], points2: T[][]): T[][] {
  const result = _.uniq(points.concat(points2).map(p => JSON.stringify(p)))
    .map(p => JSON.parse(p));
  result.sort(compareArrays);
  return result;
}

function toNormalForm(pattern: number[][]) {
  const normalForm = _.cloneDeep(pattern);
  normalForm.sort(compareArrays);
  const offset = normalForm[0];
  return normalForm.map(p => _.zipWith(p, offset, _.subtract));
}

function cloneAndSortPoints(pattern: SiatecPattern, dimension: number): Point[] {
  const points = pattern.points.map(p => p.slice()); //clone
  points.sort((a,b) => a[dimension] - b[dimension]);
  return points;
}

function newPattern(points: Point[], vectors: Vector[]): SiatecPattern {
  return {
    points: points,
    vectors: vectors,
    occurrences: vectors.map(v => points.map(pat => pat.map((p,k) => p + v[k])))
  }
}