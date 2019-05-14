import * as _ from 'lodash';
import { Point, Occurrence } from './siatec';
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