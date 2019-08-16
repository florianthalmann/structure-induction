import * as _ from 'lodash';
import { intersectSortedArrays, mergeSortedArrays } from 'arrayutils';
import { toOrderedPointString } from './util';
import { StructureResult, Point, PointSet, Vector, Occurrence } from './structure';

export interface SiatecResult extends StructureResult {
  minPatternLength: number
}

export function siatec(points: number[][], minPatternLength = 0, removeRedundant = true): SiatecResult {
  let vectorTable = getVectorTable(points);
  let patterns = calculateSiaPatterns(vectorTable);
  
  //remove short patterns
  patterns = patterns.filter(p => p.length >= minPatternLength);
  
  //calculate vectors
  const vectors = getVectorMap(points, patterns, vectorTable);
  vectorTable = null; //release memory
  
  //calculate occurrences
  let occs: Occurrence[][][] = [];
  for (let i = 0; i < patterns.length; i+=1000) {
    occs.push(toOccs(patterns.slice(i, i+1000), vectors));
  }
  let occurrences = new Map<PointSet,Occurrence[]>(_.zip(patterns, _.flatten(occs)));
  
  //remove redundant
  if (removeRedundant) {
    const reduced = {};
    patterns.forEach(p => {
      const stringO = JSON.stringify(occurrences.get(p));
      if (!reduced[stringO] || vectors.get(p).length > vectors.get(reduced[stringO]).length) {
        reduced[stringO] = p;
      }
    });
    //console.log('removed redundant:', patterns.length-_.values(reduced).length, 'of', patterns.length)
    patterns = _.values(reduced);
  }
  
  //console.log("RETURN")
  return {
    points: points,
    minPatternLength: minPatternLength,
    patterns: patterns.map((p,i) => ({
      points: p,
      vectors:vectors.get(p),
      occurrences: occurrences.get(p)
    }))
  };
}

function toOccs(patterns: PointSet[], vectors: Map<PointSet, Vector[]>) {
  return patterns.map(p => vectors.get(p).map(v =>
    p.map(point => point.map((p,k) => p + v[k]))));
}

function getVectorMap(points: Point[], patterns: PointSet[], vectorTable: [Vector, Point][][]) {
  const vectors = calculateSiatecOccurrences(points, patterns, vectorTable)
    .map(i => i.map(v => v.map(e => _.round(e,8)))); //eliminate float errors
  return new Map<PointSet, Vector[]>(_.zip(patterns, vectors));
}

function getVectorTable(points: Point[]): [Vector, Point][][] {
  return <[Vector, Point][][]> points.map(p => 
    points.map(q => [_.zipWith(q, p, _.subtract), p]));
}

//returns a list with the sia patterns detected for the given points
function calculateSiaPatterns(vectorTable: [Vector, Point][][]): PointSet[] {
  //get all the vectors below the diagonal of the translation matrix
  var halfTable = vectorTable.map((col,i) => col.slice(i+1));
  //transform into a sorted list by merging the table's columns
  var vectorList: [Vector, Point][] = mergeSortedArrays(halfTable);
  //group by translation vectors
  var patternMap = groupByKeys(vectorList);
  //get the map's values, get rid of duplicates
  return _.uniq(_.values(patternMap).map(toOrderedPointString))
    .map(p => JSON.parse(p));
}

//returns a list with the
function calculateSiatecOccurrences(points: Point[], pointSets: PointSet[], vectorTable: [Vector, Point][][]): Vector[][]  {
  var vectorMap: Map<string,number> = new Map();
  points.forEach((v,i) => vectorMap.set(JSON.stringify(v),i));
  //get rid of points of origin in vector table
  var fullTable: Vector[][] = vectorTable.map(col => col.map(row => row[0]));
  var translations = pointSets.map(pat => pat.map(point => fullTable[vectorMap.get(JSON.stringify(point))]));
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