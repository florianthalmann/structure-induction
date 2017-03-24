import * as math from 'mathjs';
import * as _ from 'lodash';
import { indexOfMax } from 'arrayutils';
import { Similarity } from './similarity';

export enum TRACES {
  DIAGONAL,
  UP,
  LEFT,
  NONE
}

export interface SmithWatermanResult {
  scoreMatrix: number[][],
  traceMatrix: number[][]
}

export class SmithWaterman {

  private matchScore = 3;
  private mismatchScore = -2;
  private gapScore = -1;

  //if similarity threshold is null, equality is enforced
  constructor(private similarityTreshold: number) {}

  run(seq1: number[][], seq2: number[][], ignoredPoints?: number[][]): SmithWatermanResult {
    if (!ignoredPoints) {
      ignoredPoints = [];
    }
    //ignore diagonal if sequences equal
    if (_.isEqual(seq1, seq2)) {
      ignoredPoints.push(...seq1.map((e,i) => [i,i]));
    }
    let ignoredPointStrings: string[] = ignoredPoints.map(p => JSON.stringify(p)).map(p => p.slice(1,p.length-1));
    return this.internalRun(seq1, seq2, ignoredPointStrings);
  }

  private internalRun(seq1: number[][], seq2: number[][], ignoredPoints: string[]): SmithWatermanResult {
    let scoreMatrix = seq1.map(s => seq2.map(t => 0));
    let traceMatrix = seq1.map(s => seq2.map(t => 0));

    seq1.forEach((s1,i) => {
      seq2.forEach((s2,j) => {
        if (i == 0 || j == 0) {
          traceMatrix[i][j] = 3;
        } else {
          let d_last = scoreMatrix[i-1][j-1];
          let u_last = scoreMatrix[i-1][j];
          let l_last = scoreMatrix[i][j-1];
          //here we don't give scores for self alignment!! hence i != j
          let notIgnored = ignoredPoints.indexOf(i+","+j) < 0;
          let d_new = d_last + (notIgnored && this.isSimilar(s1, s2) ? this.matchScore : this.mismatchScore);
          let u_new = u_last + this.gapScore;
          let l_new = l_last + this.gapScore;
          let options = [d_new, u_new, l_new, 0];
          scoreMatrix[i][j] = _.max(options);
          let trace = indexOfMax(options);
          traceMatrix[i][j] = trace;
        }
      });
    });
    //console.log(JSON.stringify(scoreMatrix))
    return {scoreMatrix:scoreMatrix, traceMatrix:traceMatrix};
  }

  private isSimilar(v1: number[], v2: number[]): boolean {
    return (this.similarityTreshold != null && Similarity.getCosineSimilarity(v1, v2) > this.similarityTreshold)
      || _.isEqual(v1, v2);
  }

}