import * as _ from 'lodash'
import { indexOfMax, compareArrays } from 'arrayutils'
import { Siatec, SiatecOptions, OPTIMIZATION } from './siatec'
import { HEURISTICS } from './heuristics'

export interface CosiatecOptions extends SiatecOptions {
  overlapping?: boolean
}

export class Cosiatec {

  private points;
  private options: CosiatecOptions;
  private patterns;
  private occurrences;
  private vectors;

  constructor(points: number[][], options?: CosiatecOptions) {
    this.points = this.getSortedCloneWithoutDupes(points);
    this.options = options;
    this.patterns = [];
    this.occurrences = [];
    this.vectors = [];
    this.calculateCosiatecPatterns(this.options ? this.options.overlapping : false);
    this.vectors = this.vectors.map(i => i.map(v => v.map(e => _.round(e,8)))); //eliminate float errors
    console.log("patterns (length, occurrences, vector): " + JSON.stringify(this.patterns.map((p,i) => [p.length, this.occurrences[i].length, this.vectors[i][1]])));
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
      var involvedPoints = new Set(_.flatten(occurrences).map(p => JSON.stringify(p)));
      var previousLength = currentPoints.length;
      currentPoints = currentPoints.map(p => JSON.stringify(p)).filter(p => !involvedPoints.has(p)).map(p => JSON.parse(p));
      //only add to results if the pattern includes some points that are in no other pattern
      if (!overlapping || previousLength > currentPoints.length) {
        console.log("remaining:", currentPoints.length, "patterns:", patterns.length,
          "max pts:", _.max(patterns.map(p=>p.length)));
        this.patterns.push(patterns[iOfMaxHeur]);
        this.occurrences.push(occurrences);
        this.vectors.push(vectors[iOfMaxHeur]);
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