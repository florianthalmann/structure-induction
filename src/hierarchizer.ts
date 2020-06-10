import * as _ from 'lodash';
import { modForReal } from './util';

export interface Segmentation {
  p: number, //position
  l: number, //length
  ts: number[] //translations
}

export class Hierarchizer {

  /** assumes that all occurrences of segments are of the same length! */
  inferHierarchyFromPatterns(patterns: number[][][]) {
    let segments = this.patternsToSegmentations(patterns);
    //segments.forEach(s => this.processSegmentPair(s));
    segments = this.processOverlaps(segments);
    //TODO NOW BUILD HIERARCHY
  }
  
  inferHierarchyFromSegmentMatrix(matrix: number[][]) {
    const size: [number, number] = [matrix.length, matrix[0].length];
    const hierarchy = this.buildHierarchy(this.matrixToSegmentations(matrix));
    return this.segmentationsToMatrix(hierarchy, size);
  }
  
  private buildHierarchy(segments: Segmentation[], minSegLength = 4, divFactor = 2) {
    //sort by length and first translation vector
    segments = this.filterAndSortSegmentations(segments, minSegLength, divFactor);
    const hierarchy: Segmentation[] = [];
    while (segments.length > 0) {
      const next = segments.shift();
      hierarchy.push(next);
      const newBorders = _.uniq(_.flatten(
        [next.p].concat(next.ts.map(t => next.p+t)).map(t => [t, t+next.l])));
      segments = newBorders.reduce((segs, b) =>
        _.flatten(segs.map(s => this.divideAtPos(s, b))), segments);
      segments = this.filterAndSortSegmentations(segments, minSegLength, divFactor);
    }
    return hierarchy;
  }
  
  private filterAndSortSegmentations(segmentations: Segmentation[],
      minSegLength: number, divFactor: number) {
    segmentations = segmentations.filter(s =>
      s.l >= minSegLength && s.ts.every(t => modForReal(t, divFactor) == 0));
    return _.reverse(_.sortBy(segmentations, s => s.l));
  }
  
  private patternsToSegmentations(patterns: number[][][]): Segmentation[] {
    return patterns.map(p => this.toSegmentation(p));
  }
  
  private matrixToSegmentations(matrix: number[][]): Segmentation[] {
    let points = _.flatten(matrix.map((row,i) => row.map((val,j) => [i,j,val])))
    points = points.filter(p => p[1] > p[0] && p[2] > 0)
    points = _.sortBy(points, p => p[1]-p[0]);
    let segments = points.reduce<number[][][]>((segs, p) => {
      const prev = _.last(_.last(segs)) || [0,0,0];
      p[0]-prev[0] == 1 && p[1]-prev[1] == 1 ?
        _.last(segs).push(p.slice(0,2)) : segs.push([p.slice(0,2)]);
      return segs;
    }, []);
    segments = _.reverse(_.sortBy(segments, s => s.length));
    return segments.map(s => this.alignmentToSegmentation(s));
  }
  
  private segmentationsToMatrix(segmentations: Segmentation[], size: [number, number]): number[][] {
    const matrix = _.range(0, size[0]).map(_i => _.range(0, size[1]).map(_j => 0));
    segmentations.forEach(s => _.range(0, s.l).forEach(i => s.ts.forEach(t => {
      matrix[s.p+i][s.p+t+i] = 1; matrix[s.p+t+i][s.p+i] = 1;
    })));
    return matrix;
  }
  
  //only keeps full occurrences TODO split off incomplete occurrences
  private alignmentToSegmentation(a: number[][]): Segmentation {
    const position = a[0][0];
    const interval = a[0][1]-a[0][0];
    const length = Math.min(a.length, interval);
    const numCopies = Math.floor(a.length/length);
    const vectors = _.range(0, numCopies).map(t => ((t+1)*interval));
    return {p: position, l: length, ts: vectors};
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
  
  divideAtPos(s: Segmentation, pos: number): Segmentation[] {
    const loc = [s.p].concat(s.ts.map(t => s.p+t)).map(p =>
      p < pos && pos < p+s.l-1 ? pos-p : -1).filter(loc => loc > -1);
    return loc.length > 0 ? this.divide(s, loc[0]) : [s];
  }

  /** divides the segmentation s at position loc */
  private divide(s: Segmentation, loc: number): Segmentation[] {
    if (0 < loc && loc < s.l-1) {
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