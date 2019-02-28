import * as _ from 'lodash';
import { intersectSortedArrays, mergeSortedArrays } from 'arrayutils';
const sizeof = require('object-sizeof');

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

export function siatec(points: number[][], outFile?: string): SiatecResult {
  console.log("TABLE")
  let vectorTable = getVectorTable(points);
  const patterns = calculateSiaPatterns(vectorTable);
  console.log("VECS")
  const vectors = calculateSiatecOccurrences(points, patterns, vectorTable)
    .map(i => i.map(v => v.map(e => _.round(e,8)))); //eliminate float errors
  vectorTable = null;
  console.log("OCCS")
  /*const occurrences = vectors.map((occ, i) => occ.map(tsl =>
    patterns[i].map(pat => pat.map((p,k) => p + tsl[k]))));*/
  
  /*function getOcc(pattern: Pattern, vector: Vector) {
    return pattern.map(point => point.map((p,k) => p + vector[k]));
  }
  
  function getOccs(pattern: Pattern, vectors: Vector[]) {
    return vectors.map(v => getOcc(pattern, v));
  }*/
  
  function toOccs(patterns: Pattern[], vectors: Vector[][]) {
    const occurrences = vectors.map((v,i) =>
      v.map(w => patterns[i].map(point => point.map((p,k) => p + w[k]))));
    return occurrences;
  }
  
  //console.log(patterns.length, sizeof(vectors)/1024/1024)
  
  let occurrences = [];
  for (let i = 0; i < vectors.length; i+=1000) {
    //console.log(Math.round(process.memoryUsage().heapUsed/1024/1024*100)/100, 'MB')
    occurrences.push(toOccs(patterns.slice(i, i+1000), vectors.slice(i, i+1000)));
  }
  
  occurrences = _.flatten(occurrences);
  
  console.log("RETURN")
  return {
    points: points,
    patterns: patterns.map((p,i) => ({
      points: p,
      vectors:vectors[i],
      occurrences: occurrences[i]
    }))
  };
}

function getVectorTable(points: Point[]): [Vector, Point][][] {
  return <[Vector, Point][][]> points.map(p => 
    points.map(q => [_.zipWith(q, p, _.subtract), p]));
}

//returns a list with the sia patterns detected for the given points
function calculateSiaPatterns(vectorTable: [Vector, Point][][]): Pattern[] {
  //get all the vectors below the diagonal of the translation matrix
  var halfTable = vectorTable.map((col,i) => col.slice(i+1));
  //transform into a sorted list by merging the table's columns
  var vectorList: [Vector, Point][] = mergeSortedArrays(halfTable);
  //group by translation vectors
  var patternMap = groupByKeys(vectorList);
  //get the map's values
  return Object.keys(patternMap).map(key => patternMap[key]);
}

//returns a list with the
function calculateSiatecOccurrences(points: Point[], patterns: Pattern[], vectorTable: [Vector, Point][][]): Vector[][]  {
  var vectorMap: Map<string,number> = new Map();
  points.forEach((v,i) => vectorMap.set(JSON.stringify(v),i));
  //get rid of points of origin in vector table
  var fullTable: Vector[][] = vectorTable.map(col => col.map(row => row[0]));
  var translations = patterns.map(pat => pat.map(point => fullTable[vectorMap.get(JSON.stringify(point))]));
  return translations.map(occ => getIntersection(occ));
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

function groupByKeys(vectors: [Vector, Point][]): {} {
  return vectors.reduce((grouped, item) => {
    var key = JSON.stringify(item[0]);
    grouped[key] = grouped[key] || [];
    grouped[key].push(item[1]);
    return grouped;
  }, {});
}