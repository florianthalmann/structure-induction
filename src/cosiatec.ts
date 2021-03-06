import * as _ from 'lodash'
import { indexOfMax, compareArrays } from 'arrayutils';
import { Pattern, Point } from './structure';
import { siatec, SiatecResult } from './siatec';
import { HEURISTICS, CosiatecHeuristic } from './heuristics';
import { toOrderedPointString } from './util';

export interface CosiatecOptions {
  overlapping?: boolean, //overlapping is jamie's algorithm
  ignoreNovelty?: boolean, //takes any best pattern even if no new points (best used together with min heuristic value)
  selectionHeuristic?: CosiatecHeuristic,
  loggingLevel?: number,
  minPatternLength?: number,
  numPatterns?: number
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
 * numPatterns defined: returns the n best overlapping cosiatec patterns, plus more if n larger than the number of cosiatec patterns
 */
function cosiatecLoop(points: Point[], options: CosiatecOptions, patterns?: Pattern[]): CosiatecResult {
  const result: CosiatecResult = {points: points, patterns: [], scores: [], minPatternLength: options.minPatternLength };
  let remainingPoints = points;
  //IN NON-OVERLAPPING THERE IS NO OPTIMIZATION SO FAR!!!!
  patterns = patterns || siatec(remainingPoints, options.minPatternLength).patterns;
  let scores = patterns.map(p => options.selectionHeuristic(p, remainingPoints));
  
  while (patterns.length > 0 && remainingPoints.length > 0
      && (!options.numPatterns || result.patterns.length < options.numPatterns)) {
    const iOfBestScore = indexOfMax(scores);
    const bestPattern = patterns[iOfBestScore];
    const previousLength = remainingPoints.length;
    remainingPoints = getComplement(bestPattern, remainingPoints);
    
    //only add to results if the pattern includes points in no other pattern
    //always true in non-overlapping cosiatec and if numPatterns higher than cosiatec patterns
    //if ignoreNovelty is true, add anyway
    if (previousLength > remainingPoints.length || options.ignoreNovelty) {
      if (options.loggingLevel > 1) logPointsAndPatterns(remainingPoints, patterns);
      result.patterns.push(bestPattern);
      result.scores.push(scores[iOfBestScore]);
    }
    
    if (options.overlapping || options.ignoreNovelty) {
      //remove best pattern and score
      [patterns, scores].forEach(a => a.splice(iOfBestScore, 1));
    } else {
      //recalculate siatec and heuristics on remaining points
      patterns = siatec(remainingPoints, options.minPatternLength).patterns;
      scores = patterns.map(p => options.selectionHeuristic(p, remainingPoints));
    }
  }
  
  //add more patterns if necessary, but only ones with differing point sets
  if (options.numPatterns && result.patterns.length < options.numPatterns) {
    const patternStrings = result.patterns.map(p => toOrderedPointString(p.points));
    
    while (patterns.length > 0 && result.patterns.length < options.numPatterns) {
      const iOfBestScore = indexOfMax(scores);
      const bestPattern = patterns[iOfBestScore];
      const bestPatternString = toOrderedPointString(bestPattern.points);
      
      if (patternStrings.indexOf(bestPatternString) < 0) {
        //console.log(toOrderedPointString(bestPattern))//, patternStrings);
        result.patterns.push(bestPattern);
        result.scores.push(scores[iOfBestScore]);
        patternStrings.push(bestPatternString);
      }
      
      [patterns, scores].forEach(a => a.splice(iOfBestScore, 1));
    }
  }
  
  return result;
}

/** returns the complement of the pattern in points */
function getComplement(pattern: Pattern, points: Point[]) {
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

function logPointsAndPatterns(points: Point[], patterns: Pattern[]) {
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