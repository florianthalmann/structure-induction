import * as fs from 'fs';
import { siatec, SiatecResult, Point } from './siatec';
import { cosiatec, CosiatecResult, CosiatecOptions } from './cosiatec';
import { CosiatecHeuristic } from './heuristics';
import { OPTIMIZATION, minLength, minimize, divide, partition } from './optimizer';

export interface OpsiatecOptions extends CosiatecOptions {
  optimizationMethods?: number[],
  optimizationHeuristic?: CosiatecHeuristic,
  optimizationDimension?: number,
  minPatternLength?: number,
  cacheDir: string
}

export function opsiatec(points: Point[], options: OpsiatecOptions): CosiatecResult {
  const siatecResult = getCachedOrRun<SiatecResult>('siatec.json',
    () => siatec(points), options);
  
  //TODO MAKE THIS FILE MORE DEPENDENT OF OPTIM TYPES!!!!!
  const optimized = getCachedOrRun<SiatecResult>('optimized.json',
    () => getOptimizedPatterns(siatecResult, options), options);
  
  //TODO MAKE THIS FILE MORE DEPENDENT OF OPTIM TYPES!!!!!
  options.siatecResult = optimized;
  return getCachedOrRun<CosiatecResult>('cosiatec.json',
    () => cosiatec(points, options), options);
}

function getOptimizedPatterns(input: SiatecResult, options: OpsiatecOptions): SiatecResult {
  //always filter for patterns of min length to optimize runtime
  let result = minLength(input, options.minPatternLength);
  
  if (options.optimizationMethods.indexOf(OPTIMIZATION.PARTITION) >= 0) {
    //TODO PARTITION ONLY IF PATTERN LENGTH > MIN
    result = partition(result, options.optimizationHeuristic, options.optimizationDimension);
    result = minLength(result, options.minPatternLength);
  }
  
  if (options.optimizationMethods.indexOf(OPTIMIZATION.DIVIDE) >= 0) {
    //TODO DIVIDE ONLY IF PATTERN LENGTH > MIN
    result = divide(result, options.optimizationHeuristic, options.optimizationDimension);
    result = minLength(result, options.minPatternLength);
  }
  
  if (options.optimizationMethods.indexOf(OPTIMIZATION.MINIMIZE) >= 0) {
    //TODO MINIMIZE ONLY IF PATTERN LENGTH > MIN
    result = minimize(result, options.optimizationHeuristic, options.optimizationDimension);
    result = minLength(result, options.minPatternLength);
  }
  
  return result;
}

function getCachedOrRun<T>(file: string, func: () => T, options: OpsiatecOptions): T {
  let results: T;
  if (options.cacheDir) {
    results = <T>loadJson(options.cacheDir+file);
  }
  if (!results) {
    results = func();
    if (options.cacheDir) {
      saveJson(options.cacheDir+file, results);
    }
  }
  return results;
}

function loadJson(file: string) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJson(path: string, json: {}) {
  fs.writeFileSync(path, JSON.stringify(json));
}