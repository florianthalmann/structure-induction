import * as _ from 'lodash';
import { loadJson } from '../src/util';
import { inferHierarchyFromMatrix, keepNBestSegments, rateHierarchy,
  getFirstPatterns, quicklyInferHierarchyFromMatrix, getEdges,
  cleanUpMatrix, addTransitivity, toPatternGraph, subGraph, graphToPattern,
  alignmentToPatterns } from '../src/hierarchies';

describe("hierarchies", () => {
  
  const testMatrix = loadJson<number[][]>('spec/test-matrix.json');
  
  it("can convert between matrices and segmentations", () => {
    const alignment = _.range(0,11).map(i => [i,i+3]);
    expect(alignmentToPatterns(alignment))
      .toEqual([[{"p":0,"l":3,"ts":[3,6,9]},{"p":9,"l":2,"ts":[3]}],
        [{"p":0,"l":1,"ts":[3]},{"p":1,"l":3,"ts":[3,6,9]},{"p":10,"l":1,"ts":[3]}],
        [{"p":0,"l":2,"ts":[3]},{"p":2,"l":3,"ts":[3,6,9]}]]);
  });
  
  it("can add transitivity", () => {
    
    const segs = [{p:0,l:8,ts:[8,16]},{p:3,l:4,ts:[32]}];
    
    expect(addTransitivity(segs))
      .toEqual([{p:0,l:8,ts:[8,16]},{p:3,l:4,ts:[8,16,32]}]);
    
  });
  
  it("can represent segmentations as graphs", () => {
    
    const s1 = {"p":339,"l":23,"ts":[96]};
    const s2 = {"p":323,"l":32,"ts":[32,64,96,128,160,192,224,256]};
    const s3 = {"p":357,"l":21,"ts":[32,64,96,128,160,192,224,256,288]};
    const g1 = toPatternGraph(s1);
    const g2 = toPatternGraph(s2);
    const g3 = toPatternGraph(s3);

    expect(graphToPattern(g1)).toEqual(s1);
    expect(graphToPattern(g2)).toEqual(s2);
    expect(graphToPattern(g3)).toEqual(s3);
    
    //test sub-segmentations
    expect(subGraph(g1, g2)).toBe(true);
    expect(subGraph(g2, g1)).toBe(false);
    expect(subGraph(g3, g2)).toBe(false);
    expect(subGraph(g2, g3)).toBe(false);
    
    //console.log(JSON.stringify(toSeg(difference(g3, g2))))
    //console.log(JSON.stringify(difference(s2, s1)))
    
    //expect(difference(g1, g2)).toEqual({});
    //expect(difference(g2, g1)).toEqual(g2);
    //expect(toSeg(difference(g3, g2))).toEqual({"p":581,"l":21,"ts":[32,64]});
    
  });
  
  it("can simplify segmentations", () => {
    
    let segs = getFirstPatterns(testMatrix);
    segs = _.reverse(_.sortBy(segs, s => s.l));
    //console.log(JSON.stringify(segs.filter(s => s.l > 1)))
    //console.log(JSON.stringify(_.groupBy(segs.map(s => _.min(s.ts)))));
    
  });

  it("can find optimal groupings", () => {
    //const threeLongest = keepNBestSegments(testMatrix, 5);
    
    //console.log(JSON.stringify(quicklyInferHierarchyFromMatrix(testMatrix)));
    //console.log(JSON.stringify(getEdges(testMatrix)))
    //console.log(JSON.stringify(getEdges(cleanUpMatrix(testMatrix))))
    
    
    
    /*expect(rateHierarchy(inferHierarchyFromMatrix(threeLongest))).toBe(170);
    
    expect(rateHierarchy(inferHierarchyFromMatrix(testMatrix))).toBe(206);*/
    
  });

});