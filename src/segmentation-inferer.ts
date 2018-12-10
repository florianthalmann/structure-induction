import * as _ from 'lodash';

interface Segmentation {
  p: number, //position
  l: number, //length
  ts: number[] //translations
}

export class SegmentationInferer {

  private segmentations: Segmentation[];

  constructor(private inputSegments: number[][][]) {}

  /** assumes that all occurrences of segments are of the same length! */
  inferHierarchy(segmentPairs: number[][][]) {
    segmentPairs.forEach(s => this.processSegmentPair(s));
    console.log(this.segmentations);
    //TODO NOW BUILD HIERARCHY
  }

  private processSegmentPair(segmentPair: number[][]) {
    let newSegments = [this.toSegmentation(segmentPair)];
    newSegments = this.processOverlaps(newSegments);
    this.segmentations.push();
  }

  private updateSegmentations() {
    //this.processOverlaps();
    //this.mergePatterns();
  }

  private toSegmentation(segmentPair: number[][]): Segmentation {
    return {
      p: segmentPair[0][0],
      l: _.last(segmentPair[0])-segmentPair[0][0],
      ts: segmentPair.map((s,i) => s[i][0]-s[0][0]).filter((s,i) => i > 0)
    };
  }

  private processOverlaps(segmentations: Segmentation[]): Segmentation[] {
    return _.flatten(segmentations.forEach(s => this.divide(s, _.min(s.ts))));
  }

  /** divides the segmentation s at position loc */
  private divide(s: Segmentation, loc: number): Segmentation[] {
    if (0 < loc && loc < s.l) {
      return [{p:s.p, l:loc, ts:s.ts}, {p:s.p+loc, l:s.l-loc, ts:s.ts}];
    }
    return [s];
  }

  private merge(s1: Segmentation, s2: Segmentation): Segmentation[] {
    if (s1.p == s2.p) {
      let minL = Math.min(s1.l, s2.l);
      let s1div = this.divide(s1, minL);
      let s2div = this.divide(s2, minL);
      return [s1div[0]]
    }
  }

}