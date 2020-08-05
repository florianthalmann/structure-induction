import * as fs from 'fs';
import * as _ from 'lodash';
import { Point, Occurrence, CacheableStructureOptions } from './structure';
import { compareArrays } from 'arrayutils';

export function createPointMatrix(selectedPoints: number[][], points: number[][],
    points2: number[][], symmetric: boolean): number[][] {
  const matrix = getEmptyMatrix(points.length, points2.length);
  selectedPoints.forEach(p => matrix[p[0]][p[1]] = 1);
  if (symmetric) selectedPoints.forEach(p => matrix[p[1]][p[0]] = 1);
  return matrix;
}

export function toPatterns(alignments: [number,number][][], points: number[][], points2: number[][]) {
  return alignments.map(a => {
    const currentSegments = toSegments(a);
    const dist = currentSegments[1][0]-currentSegments[0][0];
    const vector = points[0].map((_,i) => i == 0 ? dist : 0);
    const segmentPoints = currentSegments.map((s,i) => s.map(j => [points,points2][i][j]));
    return {points: segmentPoints[0], vectors: [vector], occurrences: segmentPoints};
  });
}

function toSegments(alignmentPoints: number[][]) {
  let currentSegments = _.zip(...alignmentPoints);
  //sort ascending
  currentSegments.forEach(o => o.sort((a,b) => a-b));
  //remove duplicates
  return currentSegments.map(occ => _.uniq(occ));
}

export function getEmptyMatrix(numRows: number, numCols: number) {
  return _.range(0, numRows).map(_r => _.fill(new Array(numCols), 0));
}

export function modForReal(n: number, mod: number) {
  return ((n%mod)+mod)%mod;
}

export function allIndexesOf<T>(array: T[], value: T) {
  return allIndexesWith(array, a => a === value);
}

export function allIndexesWith<T>(array: T[], condition: (t: T) => boolean) {
  return array.map((a,i) => condition(a) ? i : null).filter(i => i != null);
}

export function cartesianProduct<T>(arr: T[][]): T[][] {
  return arr.reduce((a, b) =>
    a.map(x => b.map(y => x.concat([y])))
      .reduce((a, b) => a.concat(b), []), [[]]);
}

export function getEntropy(data: number[]) {
  return -1 * _.sum(data.map(d => d ? d*Math.log(d) : 0));
}

export function getMedian(data: number[]) {
  data = _.sortBy(data);
  const middle = _.floor(data.length/2);
  return data.length % 2 ? data[middle] : (data[middle-1] + data[middle])/2;
}

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
  if (file && options.cacheDir) {
    return loadCached(file, options.cacheDir)
      || saveCached(file, func(), options.cacheDir);
  }
  return func();
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

export function saveJson<T>(path: string, json: T) {
  try {
    fs.writeFileSync(path, JSON.stringify(json));
  } catch (e) {
    console.log('failed to cache '+path);
  }
  return json;
}
