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
  const siatecResult = getCachedOrRun<SiatecResult>(
    'siatec.json',
    () => siatec(points), options);
  
  const optimized = getCachedOrRun<SiatecResult>(
    'optimized_'+getOptionsString(options)+'.json',
    () => getOptimizedPatterns(siatecResult, options), options);
  
  options.siatecResult = optimized;
  return getCachedOrRun<CosiatecResult>(
    'cosiatec_'+getOptionsString(options)+'.json',
    () => cosiatec(points, options), options);
}

function getOptionsString(options: OpsiatecOptions) {
  return options.optimizationMethods.map(m => m.toString()).join()
    +'_'+ (options.optimizationDimension != null ? options.optimizationDimension : '')
    +'_'+ (options.minPatternLength != null ? options.minPatternLength : '');
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
  if (options.cacheDir && fs.existsSync(options.cacheDir+file)) {
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