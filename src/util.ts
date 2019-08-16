import * as fs from 'fs';
import * as _ from 'lodash';
import { Point, Occurrence, CacheableStructureOptions } from './structure';
import { compareArrays } from 'arrayutils';

export function toOrderedPointString(points: number[][]): string {
  const clone = _.clone(points);
  clone.sort(compareArrays);
  return JSON.stringify(clone);
}

export function pointsToIndices(occurrences: Occurrence[][], points: Point[]): number[][][] {
  const pointStrings = points.map(p => JSON.stringify(p));
  return occurrences.map(occ => occ.map(pat =>
    pat.map(p => getPointIndex(p, pointStrings))));
}

function getPointIndex(point: number[], pointStrings: string[]): number {
  //quantize to get rid of float errors!
  return pointStrings.indexOf(JSON.stringify(roundPoint(point, 8)));
}

function roundPoint(point, precision) {
  return point.map(x => _.round(x, precision));
}

export function loadOrPerformAndCache<T>(file: string, func: ()=>T,
    options: CacheableStructureOptions, logString?: string): T {
  if (logString && options.loggingLevel > 0) console.log(logString);
  return loadCached(file, options.cacheDir)
    || saveCached(file, func(), options.cacheDir);
}

export function loadCached<T>(file: string, cacheDir: string) {
  if (cacheDir && fs.existsSync(cacheDir+file)) {
    return <T>loadJson(cacheDir+file);
  }
}

export function saveCached<T>(file: string, contents: T, cacheDir: string) {
  if (cacheDir) {
    return saveJson(cacheDir+file, contents);
  }
}

export function loadJson<T>(file: string) {
  return <T>JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJson<T>(path: string, json: T) {
  try {
    fs.writeFileSync(path, JSON.stringify(json));
    return json;
  } catch (e) {
    console.log('failed to cache '+path);
  }
}