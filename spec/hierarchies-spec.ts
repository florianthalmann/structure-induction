import * as _ from 'lodash';
import { loadJson } from '../src/util';
import { inferHierarchyFromMatrix, keepNBestSegments, rateHierarchy,
  getFirstPatterns, quicklyInferHierarchyFromMatrix, getEdges,
  getTransitiveMatrix, addTransitivity, toPatternGraph, subGraph, graphToPattern,
  alignmentToPatterns, inferHierarchyFromTypeSequence, minDistFromParents,
  containedBy, getDistance, patternsToMatrix, unpack } from '../src/hierarchies';
import { getSelfSimilarityMatrix } from '../src/similarity';
import { saveJson } from '../src/util';

describe("hierarchies", () => {

  const testMatrix = loadJson<number[][]>('spec/data/test-matrix.json');
  const testSequence = loadJson<string[]>('spec/data/test-sequence.json');

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

  it("can perform some basic operations on patterns", () => {

    expect(containedBy({"p":4,"l":9,"ts":[17]}, {"p":0,"l":16,"ts":[16]})).toBe(true);
    expect(getDistance({"p":4,"l":9,"ts":[17]}, {"p":0,"l":16,"ts":[16]})).toBe(1);
    expect(minDistFromParents({"p":4,"l":9,"ts":[17]}, [{"p":0,"l":16,"ts":[16]}])).toBe(1);

    expect(unpack([{"p":6,"l":4,"ts":[4,16,20]}])).toEqual([
      {p:6,l:4,ts:[4]},{p:6,l:4,ts:[16]},{p:6,l:4,ts:[20]},
      {p:10,l:4,ts:[12]},{p:10,l:4,ts:[16]},{p:22,l:4,ts:[4]}]);

  });

  it("can build hierarchies", () => {

    const plain = quicklyInferHierarchyFromMatrix(testMatrix, false);
    const simplified = quicklyInferHierarchyFromMatrix(testMatrix, true);

    console.log("plain", JSON.stringify(plain))
    console.log("simple", JSON.stringify(simplified))

    const types = _.uniq(testSequence);
    const typeSequence = testSequence.map(s => types.indexOf(s));
    console.log("SEQ", JSON.stringify(typeSequence))
    const ssm = getSelfSimilarityMatrix(typeSequence.map(t => [t]), true);
    saveJson('spec/data/ssm-matrix.json', ssm);
    saveJson('spec/data/trans-matrix3.json', getTransitiveMatrix(ssm, false));
    const ssm2 = getSelfSimilarityMatrix(typeSequence.map(t => [t]), true, 1);
    saveJson('spec/data/ssm2-matrix.json', ssm2);
    saveJson('spec/data/trans-matrix4.json', getTransitiveMatrix(ssm2, false));


    console.log("ssm", JSON.stringify(quicklyInferHierarchyFromMatrix(ssm, false, typeSequence)))
    console.log("ssm2", JSON.stringify(quicklyInferHierarchyFromMatrix(ssm2, false, typeSequence)))

    console.log("bottom up", JSON.stringify(inferHierarchyFromTypeSequence(typeSequence, false)))

  });

  it("can find optimal groupings", () => {
    //const threeLongest = keepNBestSegments(testMatrix, 5);

    //console.log(JSON.stringify(quicklyInferHierarchyFromMatrix(testMatrix)));
    //console.log(JSON.stringify(getEdges(testMatrix)))
    //console.log(JSON.stringify(getEdges(cleanUpMatrix(testMatrix))))

    //console.log(inferHierarchyFromMatrix(testMatrix)[0]);

    //expect(rateHierarchy(inferHierarchyFromMatrix(threeLongest))).toBe(170);

    //expect(rateHierarchy(inferHierarchyFromMatrix(testMatrix))).toBe(206);

  });

  it("can infer hierarchies from sequences bottom up", () => {
    const types = _.uniq(testSequence);
    const typeSequence = testSequence.map(s => types.indexOf(s));
    //console.log(typeSequence)
    const hierarchy = inferHierarchyFromTypeSequence(typeSequence, false);
    //console.log(JSON.stringify(hierarchy));


    //console.log(JSON.stringify(getSelfSimilarityMatrix(typeSequence.map(t => [t]), true, false)));

  });

});
