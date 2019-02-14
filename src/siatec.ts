import * as _ from 'lodash';
import { intersectSortedArrays, mergeSortedArrays } from 'arrayutils';

export type Point = number[];
export type Pattern = Point[];
export type Vector = number[];
export type Occurrence = Point[];

export interface SiatecPattern {
  points: Pattern,
  vectors: Vector[],
  occurrences: Occurrence[]
}

export interface SiatecResult {
  points: Point[],
  patterns: SiatecPattern[]
}

let vectorTable: [Vector, Point][][];

export function siatec(points: number[][]): SiatecResult {
  vectorTable = getVectorTable(points);
  const patterns = calculateSiaPatterns();
  const vectors = calculateSiatecOccurrences(points, patterns)
    .map(i => i.map(v => v.map(e => _.round(e,8)))); //eliminate float errors
  const occurrences = vectors.map((occ, i) => occ.map(tsl =>
    patterns[i].map(pat => pat.map((p,k) => p + tsl[k]))));
  return {
    points: points,
    patterns: patterns.map((p,i) => ({
      points: p,
      vectors: vectors[i],
      occurrences: occurrences[i]
    })
  )};
}

//returns a list with the sia patterns detected for the given points
function calculateSiaPatterns(): Pattern[] {
  //get all the vectors below the diagonal of the translation matrix
  var halfTable = vectorTable.map((col,i) => col.slice(i+1));
  //transform into a list by merging the table's columns
  var vectorList: Vector[] = mergeSortedArrays(halfTable);
  //group by translation vectors
  var patternMap = groupByKeys(vectorList);
  //get the map's values
  return Object.keys(patternMap).map(key => patternMap[key]);
}

//returns a list with the
function calculateSiatecOccurrences(points: Point[], patterns: Pattern[]): Vector[][]  {
  var vectorMap: Map<string,number> = new Map();
  points.forEach((v,i) => vectorMap.set(JSON.stringify(v),i));
  //get rid of points of origin in vector table
  var fullTable: Vector[][] = vectorTable.map(col => col.map(row => row[0]));
  var occurrences = patterns.map(pat => pat.map(point => fullTable[vectorMap.get(JSON.stringify(point))]));
  return occurrences.map(occ => getIntersection(occ));
}

//takes an array of arrays of vectors and calculates their intersection
function getIntersection(vectors: Vector[][]): Vector[] {
  if (vectors.length > 1) {
    var isect = vectors.slice(1).reduce((isect, tsls) =>
      intersectSortedArrays(isect, tsls), vectors[0]);
    return isect;
  }
  return vectors[0];
}

function getVectorTable(points: Point[]): [Vector, Point][][] {
  return <[Vector, Point][][]> points.map(p => 
    points.map(q => [_.zipWith(q, p, _.subtract), p]));
}

function groupByKeys(vectors: Vector[]) {
  return vectors.reduce((grouped, item) => {
    var key = JSON.stringify(item[0]);
    grouped[key] = grouped[key] || [];
    grouped[key].push(item[1]);
    return grouped;
  }, {});
}