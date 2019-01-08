import * as _ from 'lodash'
import { intersectSortedArrays, mergeSortedArrays, indexOfMax } from 'arrayutils'
import { HEURISTICS } from './heuristics'

export enum OPTIMIZATION {
  NONE,
  MINIMIZE,
  DIVIDE,
  PARTITION
}

export interface SiatecOptions {
  selectionHeuristic?: HEURISTICS.CosiatecHeuristic;
  optimizationMethod: number;
  optimizationHeuristic?: HEURISTICS.CosiatecHeuristic;
  optimizationDimension?: number;
}

export class Siatec {

  private points;
  private selectionHeuristic: HEURISTICS.CosiatecHeuristic;
  private optimizationMethod: number;
  private optimizationHeuristic: HEURISTICS.CosiatecHeuristic;
  private optimizationDimension: number;
  private vectorTable;
  private patterns: number[][][];
  private occurrenceVectors: number[][][];
  private occurrences: number[][][][];
  private heuristics: number[];

  constructor(points: number[][], options: SiatecOptions = {optimizationMethod:OPTIMIZATION.NONE}) {
    this.points = points;
    this.selectionHeuristic = options.selectionHeuristic || HEURISTICS.COMPACTNESS;
    this.optimizationMethod = options.optimizationMethod || OPTIMIZATION.NONE;
    this.optimizationHeuristic = options.optimizationHeuristic || HEURISTICS.COMPACTNESS;
    this.optimizationDimension = options.optimizationDimension || 0;
    this.run();
  }

  run() {
    //console.log("PATTERNS")
    this.vectorTable = this.getVectorTable(this.points);
    this.patterns = this.calculateSiaPatterns(this.points);
    //console.log("OPTIMIZING")
    //preliminary occurrence vectors for partitioning
    this.occurrenceVectors = this.calculateSiatecOccurrences(this.points, this.patterns);
    if (this.optimizationMethod === OPTIMIZATION.PARTITION) {
      this.patterns = _.flatten(this.patterns.slice(0, 550).map((p,i) => this.partitionPattern(p, this.points, this.optimizationDimension, this.occurrenceVectors[i])));
    } else if (this.optimizationMethod === OPTIMIZATION.MINIMIZE) {
      this.patterns = this.patterns.map(p => this.minimizePatternForReal(p, this.points, this.optimizationDimension));
    } else if (this.optimizationMethod === OPTIMIZATION.DIVIDE) {
      const divided = this.patterns.map(p => this.dividePattern(p, this.points, this.optimizationDimension));
      console.log(divided.length, divided.map(p => p.length).filter(p => p > 1))
      this.patterns = _.flatten(divided);
    }
    //console.log("VECTORS")
    //recalculate occurrence vectors
    this.occurrenceVectors = this.calculateSiatecOccurrences(this.points, this.patterns);
    //console.log("HEURISTICS")
    this.heuristics = this.patterns.map((p,i) => this.selectionHeuristic(p, this.occurrenceVectors[i], null, this.points));
  }

  getPatterns() {
    return this.patterns;
  }

  getOccurrenceVectors() {
    return this.occurrenceVectors;
  }

  getOccurrencesAt(patternIndex: number) {
    return this.occurrenceVectors[patternIndex]
      .map(tsl => this.patterns[patternIndex].map(pat => pat.map((p,k) => p + tsl[k])));
  }

  getOccurrences(patternIndices?: number[]): number[][][][] {
    if (!this.occurrences) {
      //console.log("OCCURRENCES")
      this.occurrences = this.occurrenceVectors.map((occ, i) => occ.map(tsl => this.patterns[i].map(pat => pat.map((p,k) => p + tsl[k]))));
    }
    return this.occurrences;
  }

  getHeuristics() {
    return this.heuristics;
  }

  //returns a list with the sia patterns detected for the given points
  private calculateSiaPatterns(points: number[][]): number[][][] {
    //get all the vectors below the diagonal of the translation matrix
    var halfTable = this.vectorTable.map((col,i) => col.slice(i+1));
    //transform into a list by merging the table's columns
    var vectorList = mergeSortedArrays(halfTable);
    //group by translation vectors
    var patternMap = this.groupByKeys(vectorList);
    //get the map's values
    return Object.keys(patternMap).map(key => patternMap[key]);
  }

  //returns a list with the
  private calculateSiatecOccurrences(points: number[][], patterns: number[][][]) {
    var vectorMap = new Map();
    points.forEach((v,i) => vectorMap.set(JSON.stringify(v),i));
    //get rid of points of origin in vector table
    var fullTable = this.vectorTable.map(col => col.map(row => row[0]));
    var occurrences = patterns.map(pat => pat.map(point => fullTable[vectorMap.get(JSON.stringify(point))]));
    occurrences = occurrences.map(occ => this.getIntersection(occ));
    return occurrences;
  }

  minimizePattern(pattern: number[][], allPoints: number[][], optimDim: number): number[][] {
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
  
  minimizePatternForReal(pattern: number[][], allPoints: number[][], optimDim: number): number[][] {
    const currentHeuristicValue = this.optimizationHeuristic(pattern, null, null, allPoints); //TODO SOMEHOW GET OCCURRENCES!!
    pattern.sort((a,b)=>b[optimDim]-a[optimDim]);
    if (pattern.length > 1) {
      //all possible connected subpatterns
      const subPatterns = _.flatten(pattern.map((_,i) => pattern.map((_,j) =>
        pattern.slice(i,pattern.length-j))));
      const heuristics = this.getAllHeuristics(subPatterns, allPoints);
      return subPatterns[indexOfMax(heuristics)];
    }
    return pattern;
  }

  dividePattern(pattern: number[][], allPoints: number[][], optimDim: number): number[][][] {
    let currentHeuristicValue = this.optimizationHeuristic(pattern, null, null, allPoints);//TODO SOMEHOW GET OCCURRENCES!!
    pattern.sort((a,b)=>b[optimDim]-a[optimDim]);
    if (pattern.length > 1) {
      let leftPatterns = this.getLeftPatterns(pattern);
      let leftHeuristics = this.getAllHeuristics(leftPatterns, allPoints);
      let rightPatterns = this.getRightPatterns(pattern).reverse();
      let rightHeuristics = this.getAllHeuristics(rightPatterns, allPoints);
      let productHeuristics = leftHeuristics.map((h,i) => h * rightHeuristics[i]);
      let indexOfBest = indexOfMax(productHeuristics);
      /*if (leftPatterns.length > 11) {
        console.log(leftPatterns.length, currentHeuristicValue, productHeuristics, indexOfBest, leftHeuristics[indexOfBest], rightHeuristics[indexOfBest]);
      }*/
      if ((indexOfBest > 0 && indexOfBest < pattern.length-1)
        && (Math.max(leftHeuristics[indexOfBest], rightHeuristics[indexOfBest]) > currentHeuristicValue)) {
        let leftPattern = pattern.slice(0, indexOfBest)
        let rightPattern = pattern.slice(indexOfBest);
        return _.flatten([this.dividePattern(leftPattern, allPoints, optimDim), this.dividePattern(rightPattern, allPoints, optimDim)]);
      }
    }
    return [pattern];
  }
  
  partitionPattern(pattern: number[][], allPoints: number[][], optimDim: number, vectors: number[][]): number[][][] {
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
      //console.log(patternLength, maxLength);
      if (patternLength >= maxLength) {
        const partitions = _.range(0, maxLength).map(offset =>
          pattern.reduce<number[][][]>((result,p) => {
            const currentPartition = result.length;
            //console.log(offset, currentPartition, p, min+(currentPartition*maxLength)-offset);
            if (_.last(result).length && p[optimDim] >= min+(currentPartition*maxLength)-offset) {
              result.push([p]);
            } else {
              _.last(result).push(p);
            }
            //console.log(result);
            return result;
          }, [[]]));
        const heuristics = partitions.map(p => this.getAllHeuristics(p, allPoints));
        //console.log(partitions.map(p => p.map(s => s.length)), heuristics);
        const maxes = heuristics.map(_.max);
        const i = indexOfMax(maxes);
        const numMaxes = maxes.reduce((n,m) => n + (m == maxes[i] ? 1 : 0), 0);
        return numMaxes == 1 ? partitions[i]
          : partitions[indexOfMax(heuristics.map(_.mean))];
      }
    }
    return [pattern];
  }

  private getLeftPatterns(pattern) {
    return pattern.map((p,i) => pattern.slice(i));
  }

  private getRightPatterns(pattern) {
    return pattern.map((p,i) => pattern.slice(0,i+1)).reverse();
  }

  private getAllHeuristics(patterns: number[][][], allPoints: number[][]) {
    return patterns.map(s => this.optimizationHeuristic(s, null, null, allPoints)); //TODO SOMEHOW GET OCCURRENCES!!
  }

  private findFirstBetterSubPattern(subPatterns, allPoints, currentHeuristicValue: number) {
    let potentialHeuristics = this.getAllHeuristics(subPatterns, allPoints);
    var firstBetterIndex = potentialHeuristics.findIndex(c => c > currentHeuristicValue);
    if (subPatterns.length > 20) {
      console.log(subPatterns.length, currentHeuristicValue, potentialHeuristics, firstBetterIndex);
    }
    return [firstBetterIndex, potentialHeuristics[firstBetterIndex]];
  }

  //takes an array of arrays of vectors and calculates their intersection
  private getIntersection(vectors) {
    if (vectors.length > 1) {
      var isect = vectors.slice(1).reduce((isect, tsls) => intersectSortedArrays(isect, tsls), vectors[0]);
      //console.log(JSON.stringify(points), JSON.stringify(isect));
      return isect;
    }
    return vectors[0];
  }

  private getVectorTable(points) {
  	return points.map((v,i) => points.map(w => [_.zipWith(w, v, _.subtract), v]));
  }

  private groupByKeys(vectors) {
    return vectors.reduce((grouped, item) => {
      var key = JSON.stringify(item[0]);
      grouped[key] = grouped[key] || [];
      grouped[key].push(item[1]);
      return grouped;
    }, {});
  }

}