import * as _ from 'lodash'
import { indexOfMax, compareArrays } from 'arrayutils'
import { siatec, SiatecResult, SiatecPattern, Point } from './siatec';
import { HEURISTICS, CosiatecHeuristic } from './heuristics'

export interface CosiatecOptions {
  overlapping?: boolean,
  selectionHeuristic?: CosiatecHeuristic,
  loggingLevel?: number
}

export interface CosiatecResult extends SiatecResult {
  scores: number[]
}

export function cosiatec(points: Point[], options: CosiatecOptions = {}, siatecResult?: SiatecResult): CosiatecResult {
  if (!options.selectionHeuristic) options.selectionHeuristic = HEURISTICS.COMPACTNESS;
  points = getSortedCloneWithoutDupes(points);
  const result = cosiatecLoop(points, options, siatecResult ? siatecResult.patterns : null);
  if (options.loggingLevel > 1) logResult(result);
  return result;
}

/**
 * returns an array of pairs of patterns along with their transpositions
 * overlapping false: original cosiatec: performs sia iteratively on remaining points, returns the best patterns of each step
 * overlapping true: jamie's cosiatec: performs sia only once, returns the best patterns necessary to cover all points
 */
function cosiatecLoop(points: Point[], options: CosiatecOptions, patterns?: SiatecPattern[]): CosiatecResult {
  const result: CosiatecResult = {points: points, patterns: [], scores: []};
  let remainingPoints = points;
  patterns = patterns || siatec(remainingPoints).patterns;
  let scores = patterns.map(p => options.selectionHeuristic(p, remainingPoints));
  
  while (remainingPoints.length > 0 && patterns.length > 0) {
    const iOfBestScore = indexOfMax(scores);
    const bestPattern = patterns[iOfBestScore];
    const previousLength = remainingPoints.length;
    remainingPoints = getComplement(bestPattern, remainingPoints);
    
    //only add to results if the pattern includes points in no other pattern
    //always true in non-overlapping cosiatec
    if (previousLength > remainingPoints.length) {
      if (options.loggingLevel > 1) logPointsAndPatterns(remainingPoints, patterns);
      result.patterns.push(bestPattern);
      result.scores.push(scores[iOfBestScore]);
    }
    
    if (options.overlapping) {
      //remove best pattern and score
      [patterns, scores].forEach(a => a.splice(iOfBestScore, 1));
    } else {
      //recalculate siatec and heuristics on remaining points
      patterns = siatec(remainingPoints).patterns;
      scores = patterns.map(p => options.selectionHeuristic(p, remainingPoints));
    }
  }
  
  return result;
}

/** returns the complement of the pattern in points */
function getComplement(pattern: SiatecPattern, points: Point[]) {
  const involvedPoints = new Set(_.flatten<number[]>(pattern.occurrences)
    .map(p => JSON.stringify(p)));
  return points.map(p => JSON.stringify(p))
    .filter(p => !involvedPoints.has(p)).map(p => JSON.parse(p));
}

function getSortedCloneWithoutDupes<T>(array: T[]): T[] {
  var clone = _.uniq(array);
  clone.sort(compareArrays);
  return clone;
}

function logPointsAndPatterns(points: Point[], patterns: SiatecPattern[]) {
  console.log("remaining:", points.length,
    "patterns:", patterns.length,
    "max length:", _.max(patterns.map(p => p.points.length)));
}

function logResult(result: CosiatecResult) {
  console.log("patterns (length, occurrences, vector, heuristic):");
  result.patterns.forEach((p,i) =>
      console.log("  "+p.points.length + ", " + p.occurrences.length+ ", "
        + p.vectors[1]+ ", " + _.round(result.scores[i], 2)));
}