import * as _ from 'lodash';
import { intersectSortedArrays, mergeSortedArrays, indexOfMax } from 'arrayutils';
import { HEURISTICS } from './heuristics';

export type Point = number[];
export type Vector = number[];
export type Pattern = Point[];
export type Occurrence = Point[];
export type Occurrences = Occurrence[];

export enum OPTIMIZATION {
  MINIMIZE,
  DIVIDE,
  PARTITION
}

export interface SiatecOptions {
  selectionHeuristic?: HEURISTICS.CosiatecHeuristic,
  optimizationMethods?: number[],
  optimizationHeuristic?: HEURISTICS.CosiatecHeuristic,
  optimizationDimension?: number,
  minPatternLength?: number
}

export class Siatec {

  private points;
  private selectionHeuristic: HEURISTICS.CosiatecHeuristic;
  private optimizationMethods: number[];
  private optimizationHeuristic: HEURISTICS.CosiatecHeuristic;
  private optimizationDimension: number;
  private minPatternLength: number;
  private vectorTable: [Vector, Point][][];
  private patterns: Pattern[];
  private occurrenceVectors: Vector[][];
  private occurrences: Occurrences[];
  private heuristics: number[];

  constructor(points: number[][], options: SiatecOptions = {}) {
    this.points = points;
    this.selectionHeuristic = options.selectionHeuristic || HEURISTICS.COMPACTNESS;
    this.optimizationMethods = options.optimizationMethods || [];
    this.optimizationHeuristic = options.optimizationHeuristic || HEURISTICS.COMPACTNESS;
    this.optimizationDimension = options.optimizationDimension || 0;
    this.minPatternLength = options.minPatternLength || 0;
    this.run();
  }

  run() {
    console.log("PATTERNS - points", this.points.length)
    this.vectorTable = this.getVectorTable(this.points);
    this.patterns = this.calculateSiaPatterns(this.points);
    //always filter for patterns of min length to optimize runtime
    this.patterns = this.patterns.filter(p => p.length >= this.minPatternLength);
    //preliminary occurrence vectors for partitioning
    console.log("OCCURRENCES - patterns", this.patterns.length)
    this.occurrenceVectors = this.calculateSiatecOccurrences(this.points, this.patterns);
    if (this.optimizationMethods.indexOf(OPTIMIZATION.PARTITION) >= 0) {
      console.log("PARTITIONING") //TODO PARTITION ONLY IF PATTERN LENGTH > MIN
      this.patterns = _.flatten<Pattern>(this.patterns.slice(0, 550).map((p,i) => this.partitionPattern(p, this.points, this.optimizationDimension, this.occurrenceVectors[i])));
      this.patterns = this.patterns.filter(p => p.length >= this.minPatternLength);
    }
    if (this.optimizationMethods.indexOf(OPTIMIZATION.DIVIDE) >= 0) {
      console.log("DIVIDING") //TODO DIVIDE ONLY IF PATTERN LENGTH > MIN
      this.patterns = _.flatten<Pattern>(this.patterns.map(p => this.dividePattern(p, this.points, this.optimizationDimension)));
      this.patterns = this.patterns.filter(p => p.length >= this.minPatternLength);
    }
    if (this.optimizationMethods.indexOf(OPTIMIZATION.MINIMIZE) >= 0) {
      console.log("MINIMIZING") //TODO MINIMIZE ONLY IF PATTERN LENGTH > MIN
      this.patterns = this.patterns.map(p => this.minimizePatternForReal(p, this.points, this.optimizationDimension));
      this.patterns = this.patterns.filter(p => p.length >= this.minPatternLength);
    }
    console.log("VECTORS - patterns", this.patterns.length)
    //recalculate occurrence vectors
    this.occurrenceVectors = this.calculateSiatecOccurrences(this.points, this.patterns);
    console.log("HEURISTICS")
    this.heuristics = this.patterns.map((p,i) => this.selectionHeuristic(p, this.occurrenceVectors[i], null, this.points));
  }

  getPatterns(): Pattern[] {
    return this.patterns;
  }

  getOccurrenceVectors(): Vector[][] {
    return this.occurrenceVectors;
  }

  getOccurrencesAt(patternIndex: number): Occurrences {
    return this.occurrenceVectors[patternIndex]
      .map(tsl => this.patterns[patternIndex].map(pat => pat.map((p,k) => p + tsl[k])));
  }

  getOccurrences(patternIndices?: number[]): Occurrences[] {
    if (!this.occurrences) {
      console.log("OCCURRENCES")
      this.occurrences = this.occurrenceVectors.map((occ, i) => occ.map(tsl => this.patterns[i].map(pat => pat.map((p,k) => p + tsl[k]))));
    }
    return this.occurrences;
  }

  getHeuristics() {
    return this.heuristics;
  }

  //returns a list with the sia patterns detected for the given points
  private calculateSiaPatterns(points: Point[]): Pattern[] {
    //get all the vectors below the diagonal of the translation matrix
    var halfTable = this.vectorTable.map((col,i) => col.slice(i+1));
    //transform into a list by merging the table's columns
    var vectorList: Vector[] = mergeSortedArrays(halfTable);
    //group by translation vectors
    var patternMap = this.groupByKeys(vectorList);
    //get the map's values
    return Object.keys(patternMap).map(key => patternMap[key]);
  }

  //returns a list with the
  private calculateSiatecOccurrences(points: Point[], patterns: Pattern[]): Vector[][]  {
    var vectorMap: Map<string,number> = new Map();
    points.forEach((v,i) => vectorMap.set(JSON.stringify(v),i));
    //get rid of points of origin in vector table
    var fullTable: Vector[][] = this.vectorTable.map(col => col.map(row => row[0]));
    var occurrences = patterns.map(pat => pat.map(point => fullTable[vectorMap.get(JSON.stringify(point))]));
    return occurrences.map(occ => this.getIntersection(occ));
  }

  minimizePattern(pattern: Pattern, allPoints: Point[], optimDim: number): Pattern {
    let currentHeuristicValue = this.optimizationHeuristic(pattern, null, null, allPoints); //TODO SOMEHOW GET OCCURRENCES!!
    pattern.sort((a,b)=>b[optimDim]-a[optimDim]);
    if (pattern.length > 1) {
      //see if minimizable from left
      let leftPatterns = pattern.map((p,i) => pattern.slice(i));
      let left = this.findFirstBetterSubPattern(leftPatterns, allPoints, currentHeuristicValue);
      //see if minimizable from right
      let rightPatterns = pattern.map((p,i) => pattern.slice(0,i+1)).reverse();
      let right = this.findFirstBetterSubPattern(rightPatterns, allPoints, currentHeuristicValue);

      let betterPattern;
      if (left[0] > -1 && right[0] > -1) {
        if (left[0] == right[0]) { //take pattern with better heuristic value
          betterPattern = left[1] >= right[1] ? leftPatterns[left[0]] : rightPatterns[right[0]];
        } else { //take pattern that keeps more elements
          betterPattern = left[0] <= right[0] ? leftPatterns[left[0]] : rightPatterns[right[0]];
        }
      } else if (left[0] > -1) { //only left worked
        betterPattern = leftPatterns[left[0]];
      } else if (right[0] > -1) { //only right worked
        betterPattern = rightPatterns[right[0]];
      }
      if (betterPattern) {
        return this.minimizePattern(betterPattern, allPoints, optimDim);
      }
    }
    return pattern;
  }
  
  minimizePatternForReal(pattern: Pattern, allPoints: Point[], optimDim: number): Pattern {
    const currentHeuristicValue = this.optimizationHeuristic(pattern, null, null, allPoints); //TODO SOMEHOW GET OCCURRENCES!!
    pattern.sort((a,b)=>b[optimDim]-a[optimDim]);
    if (pattern.length > 1) {
      //all possible connected subpatterns
      const subPatterns: Pattern[] = _.flatten<Pattern>(pattern.map((_,i) =>
        pattern.map((_,j) => pattern.slice(i,pattern.length-j))));
      const heuristics = this.getAllHeuristics(subPatterns, allPoints);
      return subPatterns[indexOfMax(heuristics)];
    }
    return pattern;
  }

  dividePattern(pattern: Pattern, allPoints: Point[], optimDim: number): Pattern[] {
    let currentHeuristicValue = this.optimizationHeuristic(pattern, null, null, allPoints);//TODO SOMEHOW GET OCCURRENCES!!
    pattern.sort((a,b)=>b[optimDim]-a[optimDim]);
    if (pattern.length > 1) {
      const patternPairs = pattern.map((_,i) => [pattern.slice(0,i), pattern.slice(i)]);
      const heuristics = patternPairs.map(p => this.getAllHeuristics(p, allPoints));
      const maxes = heuristics.map(_.max);
      const index: number = indexOfMax(maxes);
      if (maxes[index] > currentHeuristicValue) {
        return this.dividePattern(pattern.slice(0, index), allPoints, optimDim)
          .concat(this.dividePattern(pattern.slice(index), allPoints, optimDim));
      }
    }
    return [pattern];
  }
  
  partitionPattern(pattern: Pattern, allPoints: Point[], optimDim: number, vectors: number[][]): Pattern[] {
    let currentHeuristicValue = this.optimizationHeuristic(pattern, vectors, null, allPoints);//TODO SOMEHOW GET OCCURRENCES!!
    pattern.sort((a,b)=>a[optimDim]-b[optimDim]);
    if (vectors.length > 1 && pattern.length > 1) {
      const vals = vectors.map(v => v[optimDim]);
      const dists = _.flatten(vals.map((v,i) =>
        vals.filter((w,j) => j>i).map(w => Math.abs(v-w))));
      const maxLength = _.min(dists);
      const min = pattern[0][optimDim];
      const max = _.last(pattern)[optimDim];
      const patternLength = max-min;
      if (patternLength >= maxLength) {
        const partitions = _.range(0, maxLength).map(offset =>
          pattern.reduce<number[][][]>((result,p) => {
            const currentPartition = result.length;
            if (_.last(result).length && p[optimDim] >= min+(currentPartition*maxLength)-offset) {
              result.push([p]);
            } else {
              _.last(result).push(p);
            }
            return result;
          }, [[]]));
        const heuristics = partitions.map(p => this.getAllHeuristics(p, allPoints));
        //console.log(partitions.map(p => p.map(s => s.length)), heuristics);
        const maxes = heuristics.map(_.max);
        const i = indexOfMax(maxes);
        const numMaxes = maxes.reduce((n,m) => n + (m == maxes[i] ? 1 : 0), 0);
        //return the partition with the highest max heuristic,
        //and with the highest average if there are several ones
        return numMaxes == 1 ? partitions[i]
          : partitions[indexOfMax(heuristics.map(_.mean))];
      }
    }
    return [pattern];
  }

  private getAllHeuristics(patterns: Pattern[], allPoints: Point[]): number[] {
    return patterns.map(s => this.optimizationHeuristic(s, null, null, allPoints)); //TODO SOMEHOW GET OCCURRENCES!!
  }

  private findFirstBetterSubPattern(subPatterns, allPoints, currentHeuristicValue: number) {
    let potentialHeuristics = this.getAllHeuristics(subPatterns, allPoints);
    var firstBetterIndex = potentialHeuristics.findIndex(c => c > currentHeuristicValue);
    return [firstBetterIndex, potentialHeuristics[firstBetterIndex]];
  }

  //takes an array of arrays of vectors and calculates their intersection
  private getIntersection(vectors: Vector[][]): Vector[] {
    if (vectors.length > 1) {
      var isect = vectors.slice(1).reduce((isect, tsls) =>
        intersectSortedArrays(isect, tsls), vectors[0]);
      //console.log(JSON.stringify(points), JSON.stringify(isect));
      return isect;
    }
    return vectors[0];
  }

  private getVectorTable(points: Point[]): [Vector, Point][][] {
    return <[Vector, Point][][]> points.map((p,i) => 
      points.map(q => [_.zipWith(q, p, _.subtract), p]));
  }

  private groupByKeys(vectors: Vector[]) {
    return vectors.reduce((grouped, item) => {
      var key = JSON.stringify(item[0]);
      grouped[key] = grouped[key] || [];
      grouped[key].push(item[1]);
      return grouped;
    }, {});
  }

}