import * as _ from 'lodash';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { siatec, SiatecResult, Point } from './siatec';
import { cosiatec, CosiatecResult, CosiatecOptions } from './cosiatec';
import { CosiatecHeuristic } from './heuristics';
import { OPTIMIZATION, minLength, minimize, divide, partition } from './optimizer';

export interface OpsiatecOptions extends CosiatecOptions {
  optimizationMethods?: number[],
  optimizationHeuristic?: CosiatecHeuristic,
  optimizationDimension?: number,
  minPatternLength?: number,
  minHeuristicValue?: number,
  numPatterns?: number,
  cacheDir?: string,
  siatecCacheDir?: string
}

export interface OpsiatecResult extends CosiatecResult {
  numSiatecPatterns: number,
  numOptimizedPatterns: number
}

interface OptimizedResult extends SiatecResult {
  numSiatecPatterns: number,
  numOptimizedPatterns?: number
}

export function opsiatec(points: Point[], options: OpsiatecOptions): OpsiatecResult {
  const result = getCosiatec(points, options);
  if (options.minHeuristicValue) {
    result.patterns = result.patterns.filter((_,i) =>
      result.scores[i] >= this.options.minHeuristicValue);
    result.scores = result.scores.filter(s => s >= this.options.minHeuristicValue);
  }
  if (options.numPatterns) {
    result.patterns = result.patterns.slice(0, this.options.numPatterns);
    result.scores = result.scores.slice(0, this.options.numPatterns);
  }
  return result;
}

function getCosiatec(points: Point[], options: OpsiatecOptions): OpsiatecResult {
  const file = 'cosiatec_'+getCosiatecOptionsString(options)+'.json';
  let result = <OpsiatecResult>loadCached(file, options.cacheDir);
  if (!result) {
    const optimized = getOptimized(points, options);
    const cosiatec = performAndCache("    COSIATEC",
      () => cosiatec(points, options, optimized),
      file, options, options.cacheDir);
    result = Object.assign({}, cosiatec, {
      numSiatecPatterns: optimized.numSiatecPatterns,
      numOptimizedPatterns: optimized.numOptimizedPatterns
    });
  }
  return result;
}

function getOptimized(points: Point[], options: OpsiatecOptions): OptimizedResult {
  if (needToOptimize(options)) {
    const file = 'optimized_'+getOptimOptionsString(options)+'.json';
    let result = <OptimizedResult>loadCached(file, options.cacheDir);
    if (!result) {
      const input = getSiatec(points, options);
      //result = performAndCache<SiatecResult>("    OPTIMIZING",
        //() => getOptimizedPatterns(input, options), file, options);
      const optimized = getOptimizedPatterns(input, options);
      result = Object.assign({}, optimized, {
        numSiatecPatterns: input.patterns.length,
        numOptimizedPatterns: optimized.patterns.length
      });
    }
    return result;
  }
  const siatec = getSiatec(points, options);
  return Object.assign({}, siatec, {numSiatecPatterns: siatec.patterns.length});
}

export function getSiatec(points: Point[], options: OpsiatecOptions): SiatecResult {
  const dir = options.siatecCacheDir ? options.siatecCacheDir : options.cacheDir;
  let result = loadCachedSiatec(dir);
  if (!result) {
    result = performAndCacheSiatec(points, options, dir); //pySiatec(points, file);
  }
  return result;
}

function pySiatec(points, file) {
  console.log("starting pysiatec", JSON.stringify(points), file)
  console.log(execute("python src/siatec.py '"+JSON.stringify(points) + "' '" + file + "'"));
  return loadJson(file);
}

export function getCosiatecOptionsString(options: OpsiatecOptions) {
  return getOptimOptionsString(options)
    +'_'+ (options.overlapping ? options.overlapping : false);
}

function getOptimOptionsString(options: OpsiatecOptions) {
  return _.sortBy(options.optimizationMethods).map(m => m.toString()).join('')
    +'_'+ (options.optimizationDimension != null ? options.optimizationDimension : '')
    +'_'+ (options.minPatternLength != null ? options.minPatternLength : '');
}

function needToOptimize(options: OpsiatecOptions) {
  return (options.optimizationMethods && options.optimizationMethods.length > 0)
    || options.minPatternLength > 1;
}

function getOptimizedPatterns(input: SiatecResult, options: OpsiatecOptions): SiatecResult {
  //always filter for patterns of min length to optimize runtime
  let result = minLength(input, options.minPatternLength);
  
  if (options.optimizationMethods && options.optimizationMethods.indexOf(OPTIMIZATION.PARTITION) >= 0) {
    //TODO PARTITION ONLY IF PATTERN LENGTH > MIN
    if (options.loggingLevel > 0) console.log("    PARTITIONING");
    result = partition(result, options.optimizationHeuristic, options.optimizationDimension);
    result = minLength(result, options.minPatternLength);
  }
  
  if (options.optimizationMethods && options.optimizationMethods.indexOf(OPTIMIZATION.DIVIDE) >= 0) {
    //TODO DIVIDE ONLY IF PATTERN LENGTH > MIN
    if (options.loggingLevel > 0) console.log("    DIVIDING");
    result = divide(result, options.optimizationHeuristic, options.optimizationDimension);
    result = minLength(result, options.minPatternLength);
  }
  
  if (options.optimizationMethods && options.optimizationMethods.indexOf(OPTIMIZATION.MINIMIZE) >= 0) {
    //TODO MINIMIZE ONLY IF PATTERN LENGTH > MIN
    if (options.loggingLevel > 0) console.log("    MINIMIZING");
    result = minimize(result, options.optimizationHeuristic, options.optimizationDimension);
    result = minLength(result, options.minPatternLength);
  }
  
  return result;
}

function loadCachedSiatec(cacheDir: string): SiatecResult {
  //single file
  if (fs.existsSync(cacheDir+'siatec.json')) {
    return loadJson(cacheDir+'siatec.json');
  }
}

function performAndCacheSiatec(points: Point[], options: OpsiatecOptions, cacheDir: string) {
  if (options.loggingLevel > 0) console.log('    SIATEC');
  const result = siatec(points, options.minPatternLength);
  saveCached('siatec.json', result, cacheDir);
  return result;
}

function performAndCache<T>(taskname: string, func: () => T, filename: string, options: OpsiatecOptions, cacheDir: string) {
  if (options.loggingLevel > 0) console.log(taskname);
  const result = func();
  saveCached(filename, result, cacheDir);
  return result;
}

function loadCached<T>(file: string, cacheDir: string) {
  if (cacheDir && fs.existsSync(cacheDir+file)) {
    return <T>loadJson(cacheDir+file);
  }
}

function saveCached(file: string, contents: {}, cacheDir: string) {
  if (cacheDir) {
    saveJson(cacheDir+file, contents);
  }
}

function loadJson(file: string) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJson(path: string, json: {}) {
  fs.writeFileSync(path, JSON.stringify(json));
}

function execute(command: string) {
  let options = {shell: '/bin/bash'}//{stdio: ['pipe', 'pipe', 'ignore']};
  return execSync(command, options);
}