import * as _ from 'lodash'
import { indexOfMax, compareArrays } from 'arrayutils'
import { Siatec, SiatecOptions, OPTIMIZATION } from './siatec'
import { HEURISTICS } from './heuristics'

export interface CosiatecOptions extends SiatecOptions {
  overlapping?: boolean,
  loggingOn?: boolean 
}

export class Cosiatec {

  private points;
  private patterns: number[][][] = [];
  private occurrences: number[][][][] = [];
  private vectors: number[][][] = [];
  private heuristics: number[] = [];

  constructor(points: number[][], private options?: CosiatecOptions) {
    this.points = this.getSortedCloneWithoutDupes(points);
    this.calculateCosiatecPatterns(this.options ? this.options.overlapping : false);
    this.vectors = this.vectors.map(i => i.map(v => v.map(e => _.round(e,8)))); //eliminate float errors
    if (this.options.loggingOn) {
      console.log("patterns (length, occurrences, vector, heuristic):");
      this.patterns.forEach((p,i) =>
          console.log("  "+p.length + ", " + this.occurrences[i].length+ ", " + this.vectors[i][1]+ ", " + _.round(this.heuristics[i], 2)));
    }
  }

  getPatterns(patternIndices?: number[]): number[][][] {
    if (patternIndices != null) {
      return this.patterns.filter((p,i) => patternIndices.indexOf(i) >= 0);
    }
    return this.patterns;
  }

  getOccurrences(patternIndices?: number[]): number[][][][] {
    if (patternIndices != null) {
      return this.occurrences.filter((p,i) => patternIndices.indexOf(i) >= 0);
    }
    return this.occurrences;
  }

  getOccurrenceVectors(): number[][][] {
    return this.vectors;
  }
  
  getHeuristics(): number[] {
    return this.heuristics;
  }

  /**
   * returns an array of pairs of patterns along with their transpositions
   * overlapping false: original cosiatec: performs sia iteratively on remaining points, returns the best patterns of each step
   * overlapping true: jamie's cosiatec: performs sia only once, returns the best patterns necessary to cover all points
   */
  private calculateCosiatecPatterns(overlapping: boolean) {
    var currentPoints = this.points;
    let siatec = new Siatec(currentPoints, this.options);
    let [patterns, vectors, heuristics] = [siatec.getPatterns(), siatec.getOccurrenceVectors(), siatec.getHeuristics()];
    while (currentPoints.length > 0 && patterns.length > 0) {
      var iOfMaxHeur = indexOfMax(heuristics);
      let occurrences = siatec.getOccurrencesAt(iOfMaxHeur);
      var involvedPoints = new Set(_.flatten<number[]>(occurrences).map(p => JSON.stringify(p)));
      var previousLength = currentPoints.length;
      currentPoints = currentPoints.map(p => JSON.stringify(p)).filter(p => !involvedPoints.has(p)).map(p => JSON.parse(p));
      //only add to results if the pattern includes some points that are in no other pattern
      if (!overlapping || previousLength > currentPoints.length) {
        if (this.options.loggingOn) {
          console.log("remaining:", currentPoints.length,
            "patterns:", patterns.length,
            "max pts:", _.max(patterns.map(p=>p.length)));
        }
        this.patterns.push(patterns[iOfMaxHeur]);
        this.occurrences.push(occurrences);
        this.vectors.push(vectors[iOfMaxHeur]);
        this.heuristics.push(heuristics[iOfMaxHeur]);
      }
      if (overlapping) {
        this.removeElementAt(iOfMaxHeur, patterns, vectors, heuristics);
      } else {
        siatec = new Siatec(currentPoints, this.options);
        [patterns, vectors, heuristics] = [siatec.getPatterns(), siatec.getOccurrenceVectors(), siatec.getHeuristics()];
      }
    }
  }

  private getSiatec(points: number[][]) {
    var siatec = new Siatec(points, this.options);
    var patterns = siatec.getPatterns();
    var vectors = siatec.getOccurrenceVectors();
    var heuristics = siatec.getHeuristics();
    return [patterns, vectors, heuristics];
  }

  private removeElementAt(index: number, ...arrays) {
    arrays.forEach(a => a.splice(index, 1));
  }

  private getSortedCloneWithoutDupes(array) {
    var clone = _.uniq(array);
    clone.sort(compareArrays);
    return clone;
  }

}