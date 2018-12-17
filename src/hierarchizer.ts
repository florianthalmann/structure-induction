import * as _ from 'lodash';

export interface Segmentation {
  p: number, //position
  l: number, //length
  ts: number[] //translations
}

export class Hierarchizer {

  /** assumes that all occurrences of segments are of the same length! */
  inferHierarchyFromPatterns(patterns: number[][][]) {
    let segments = this.patternsToSegments(patterns);
    //segments.forEach(s => this.processSegmentPair(s));
    segments = this.processOverlaps(segments);
    //TODO NOW BUILD HIERARCHY
  }
  
  private patternsToSegments(patterns: number[][][]): Segmentation[] {
    return patterns.map(p => this.toSegmentation(p));
  }

  /*private patternToSegments(segmentPair: number[][]) {
    let newSegments = [this.toSegmentation(segmentPair)];
    newSegments = this.processOverlaps(newSegments);
    this.segmentations.push();
  }*/

  private updateSegmentations() {
    //this.processOverlaps();
    //this.mergePatterns();
  }

  private toSegmentation(pattern: number[][]): Segmentation {
    const length = _.last(pattern[0])-pattern[0][0];
    return {
      p: pattern[0][0],
      l: length,
      ts: pattern.slice(1).map(p => p[0]-pattern[0][0])
    };
  }

  private processOverlaps(segmentations: Segmentation[]): Segmentation[] {
    return _.flatten(segmentations.map(s => this.split(s)));
  }
  
  private split(s: Segmentation): Segmentation[] {
    const segs = [];
    let ts = _.min(s.ts);
    while (s.l > ts) {
      const div = this.divide(s, ts);
      segs.push(div[0]);
      s = div[1];
    }
    segs.push(s);
    return segs;
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