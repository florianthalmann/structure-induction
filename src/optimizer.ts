import * as _ from 'lodash';
import { indexOfMax } from 'arrayutils';
import { SiatecResult, SiatecPattern, Point, Pattern, Vector } from './siatec';
import { CosiatecHeuristic } from './heuristics';

export enum OPTIMIZATION {
  MINIMIZE,
  DIVIDE,
  PARTITION
}

export function minLength(input: SiatecResult, minLength: number): SiatecResult {
  return {
    points: input.points,
    patterns: input.patterns.filter(p => p.points.length >= minLength)
  }
}

export function minimize(input: SiatecResult, heuristic: CosiatecHeuristic, dimension: number): SiatecResult {
  console.log("MINIMIZING") //TODO PARTITION ONLY IF PATTERN LENGTH > MIN
  const patterns = input.patterns.map(p =>
    minimizePattern(p, input.points, dimension, heuristic));
  return { points: input.points, patterns: patterns };
}

export function divide(input: SiatecResult, heuristic: CosiatecHeuristic, dimension: number): SiatecResult {
  console.log("DIVIDING") //TODO PARTITION ONLY IF PATTERN LENGTH > MIN
  const patterns = _.flatten<SiatecPattern>(input.patterns.map(p =>
    dividePattern(p, input.points, dimension, heuristic)));
  return { points: input.points, patterns: patterns };
}

export function partition(input: SiatecResult, heuristic: CosiatecHeuristic, dimension: number): SiatecResult {
  console.log("PARTITIONING") //TODO PARTITION ONLY IF PATTERN LENGTH > MIN
  const patterns = _.flatten<SiatecPattern>(input.patterns.map(p =>
    partitionPattern(p, input.points, dimension, heuristic)));
  return { points: input.points, patterns: patterns };
}

function minimizePattern(pattern: SiatecPattern, allPoints: Point[], dimension: number, heuristic: CosiatecHeuristic): SiatecPattern {
  const points = cloneAndSortPoints(pattern, dimension);
  if (points.length > 1) {
    //all possible connected subpatterns
    const subPatterns = _.flatten<SiatecPattern>(points.map((_,i) =>
      points.map((_,j) => newPattern(points.slice(i, points.length-j), pattern.vectors))));
    const heuristics = subPatterns.map(p => heuristic(p, allPoints));
    return subPatterns[indexOfMax(heuristics)];
  }
  return pattern;
}

export function dividePattern(pattern: SiatecPattern, allPoints: Point[], dimension: number, heuristic: CosiatecHeuristic): SiatecPattern[] {
  const cloned = newPattern(cloneAndSortPoints(pattern, dimension), pattern.vectors);
  return recursiveDividePattern(cloned, allPoints, dimension, heuristic);
} 

function recursiveDividePattern(pattern: SiatecPattern, allPoints: Point[], dimension: number, heuristic: CosiatecHeuristic): SiatecPattern[] {
  const currentHeuristicValue = heuristic(pattern, allPoints);
  if (pattern.points.length > 1) {
    const patternPairs = pattern.points.map((_,i) =>
      [pattern.points.slice(0,i), pattern.points.slice(i)]);
    const heuristics = patternPairs.map(ps => ps.map(p =>
      heuristic(newPattern(p, pattern.vectors), allPoints)));
    const maxes = heuristics.map(_.max);
    const index: number = indexOfMax(maxes);
    if (maxes[index] > currentHeuristicValue) {
      const left = newPattern(pattern.points.slice(0, index), pattern.vectors);
      const right = newPattern(pattern.points.slice(index), pattern.vectors);
      return recursiveDividePattern(left, allPoints, dimension, heuristic)
        .concat(recursiveDividePattern(right, allPoints, dimension, heuristic));
    }
  }
  return [pattern];
}

/** partitions the given pattern along the given dimension */
export function partitionPattern(pattern: SiatecPattern, allPoints: Point[], dimension: number, heuristic: CosiatecHeuristic): SiatecPattern[] {
  const points = cloneAndSortPoints(pattern, dimension);
  if (pattern.vectors.length > 1 && points.length > 1) {
    const vals = pattern.vectors.map(v => v[dimension]);
    const dists = _.flatten(vals.map((v,i) =>
      vals.filter((_,j) => j>i).map(w => Math.abs(v-w))));
    const maxLength = _.min(dists);
    const min = points[0][dimension];
    const max = _.last(points)[dimension];
    const patternLength = max-min;
    if (patternLength >= maxLength) {
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
        const heuristics = partitions.map(ps => ps.map(p =>
          heuristic(newPattern(p, pattern.vectors), allPoints)));
        const maxes = heuristics.map(_.max);
        const i = indexOfMax(maxes);
        const numMaxes = maxes.reduce((n,m) => n + (m == maxes[i] ? 1 : 0), 0);
        //return the partition with the highest max heuristic,
        //and with the highest average if there are several ones
        const bestPartition = numMaxes == 1 ? partitions[i]
          : partitions[indexOfMax(heuristics.map(_.mean))];
        return bestPartition.map(p => newPattern(p, pattern.vectors));
      }
    }
  }
  return [pattern];
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