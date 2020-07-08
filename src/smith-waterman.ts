import * as _ from 'lodash';
import { indexOfMax } from 'arrayutils';
import { getCosineSimilarity } from './similarity';

export enum TRACES {
  NONE,
  DIAGONAL,
  UP,
  LEFT
}

export interface SmithWatermanResult {
  scoreMatrix: number[][],
  traceMatrix: number[][]
}

export const GAP_SCORE = -5;

export class SmithWaterman {

  private matchScore = 3;
  private mismatchScore = -2;
  private gapScore = GAP_SCORE;

  //if similarity threshold is null, equality is enforced
  constructor(private similarityTreshold = null) {}

  run(seq1: number[][], seq2: number[][], ignoredPoints = new Set<string>()): SmithWatermanResult {
    ignoredPoints = _.clone(ignoredPoints);
    //ignore diagonal if sequences equal
    if (_.isEqual(seq1, seq2)) {
      seq1.map((_e,i) => ignoredPoints.add(i+","+i));
    }
    return this.internalRun(seq1, seq2, ignoredPoints);
  }

  private internalRun(seq1: number[][], seq2: number[][], ignoredPoints: Set<string>): SmithWatermanResult {
    let scoreMatrix = seq1.map(s => seq2.map(t => 0));
    let traceMatrix = seq1.map(s => seq2.map(t => 0));

    seq1.forEach((s1,i) => {
      seq2.forEach((s2,j) => {
        let d_last = i > 0 && j > 0 ? scoreMatrix[i-1][j-1] : 0;
        let u_last = i > 0 ? scoreMatrix[i-1][j] : 0;
        let l_last = j > 0 ? scoreMatrix[i][j-1] : 0;
        //here we don't give scores for self alignment!! hence i != j
        let notIgnored = !ignoredPoints.has(i+","+j);
        let d_new = d_last + (notIgnored && this.isSimilar(s1, s2) ? this.matchScore : this.mismatchScore);
        let u_new = u_last + this.gapScore;
        let l_new = l_last + this.gapScore;
        //ORDER NEEDS TO CORRESPOND TO TRACES ENUM ABOVE!!!!
        let options = [0, d_new, u_new, l_new];
        scoreMatrix[i][j] = _.max(options);
        let trace = indexOfMax(options);
        traceMatrix[i][j] = trace;
      });
    });
    //console.log(JSON.stringify(scoreMatrix))
    return {scoreMatrix:scoreMatrix, traceMatrix:traceMatrix};
  }

  //negative similarityTreshold interpreted as min intersection ratio
  private isSimilar(v1: number[], v2: number[]): boolean {
    return (this.similarityTreshold > 0 && getCosineSimilarity(v1, v2) >= this.similarityTreshold)
      || (this.similarityTreshold < 0 && this.intersect(v1, v2) >= -1*this.similarityTreshold)
      || _.isEqual(v1, v2);
  }

  private intersect(v1: number[], v2: number[]): number {
    return _.intersection(v1, v2).length / v1.length;
  }

}