import * as _ from 'lodash'
import { indexOfMax, compareArrays } from 'arrayutils'
import { siatec, SiatecResult, Point } from './siatec';
import { HEURISTICS, CosiatecHeuristic } from './heuristics'

export interface CosiatecOptions {
  overlapping?: boolean,
  selectionHeuristic?: CosiatecHeuristic,
  siatecResult?: SiatecResult,
  loggingOn?: boolean
}

export interface CosiatecResult extends SiatecResult {
  scores: number[]
}

export function cosiatec(points: Point[], options: CosiatecOptions = {}): CosiatecResult {
  if (!options.selectionHeuristic) options.selectionHeuristic = HEURISTICS.COMPACTNESS;
  points = getSortedCloneWithoutDupes(points);
  const result = recursiveCosiatec(points, options);
  !options.loggingOn || logResult(result);
  return result;
}

/**
 * returns an array of pairs of patterns along with their transpositions
 * overlapping false: original cosiatec: performs sia iteratively on remaining points, returns the best patterns of each step
 * overlapping true: jamie's cosiatec: performs sia only once, returns the best patterns necessary to cover all points
 */
function recursiveCosiatec(points: Point[], options: CosiatecOptions, heuristics?: number[]): CosiatecResult {
  if (!options.siatecResult || !options.overlapping) 
    options.siatecResult = siatec(points);
  if (!heuristics || !options.overlapping)
    heuristics = getHeuristics(points, options);
  const iOfMaxScore = indexOfMax(heuristics);
  const bestScore = heuristics[iOfMaxScore];
  const bestPattern = options.siatecResult.patterns[iOfMaxScore];
  const involvedPoints = new Set(_.flatten<number[]>(bestPattern.occurrences)
    .map(p => JSON.stringify(p)));
  const previousLength = points.length;
  const remainingPoints = points.map(p => JSON.stringify(p))
    .filter(p => !involvedPoints.has(p)).map(p => JSON.parse(p));
  let result: CosiatecResult;
  //recursive call if points and patterns remaining
  if (remainingPoints.length > 0 && options.siatecResult.patterns.length > 1) {
    removePatternAt(iOfMaxScore, options.siatecResult, heuristics);
    result = recursiveCosiatec(remainingPoints, options, heuristics);
  } else {
    result = {points: points, patterns: [], scores: []};
  }
  //only add to results if the pattern includes some points that are in no other pattern
  if (previousLength > remainingPoints.length) {
    !options.loggingOn || logPointsAndPatterns(remainingPoints, options.siatecResult);
    result.patterns.unshift(bestPattern);
    result.scores.unshift(bestScore);
  }
  return result;
}

function getHeuristics(points: Point[], options: CosiatecOptions): number[] {
  console.log("HEURISTICS")
  return options.siatecResult.patterns.map(p =>
    options.selectionHeuristic(p, points));
}

function removePatternAt(index: number, result: SiatecResult, heuristics: number[]) {
  [result.patterns, heuristics].forEach(a => a.splice(index, 1));
}

function getSortedCloneWithoutDupes<T>(array: T[]): T[] {
  var clone = _.uniq(array);
  clone.sort(compareArrays);
  return clone;
}

function logPointsAndPatterns(points: Point[], result: SiatecResult) {
  console.log("remaining:", points.length,
    "patterns:", result.patterns.length,
    "max length:", _.max(result.patterns.map(p => p.points.length)));
}

function logResult(result: CosiatecResult) {
  console.log("patterns (length, occurrences, vector, heuristic):");
  result.patterns.forEach((p,i) =>
      console.log("  "+p.points.length + ", " + p.occurrences.length+ ", "
        + p.vectors[1]+ ", " + _.round(result.scores[i], 2)));
}