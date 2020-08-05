import { loadJson } from '../src/util';
import { getCosineSimilarity, getSelfSimilarityMatrix,
  getDiagonalIndexPairs, getNonzeroDiagonalSegments,
  getSimilarityAlignment } from '../src/similarity';

describe("similarity", () => {
  
  const testMatrix = loadJson<number[][]>('spec/data/test-matrix.json');
  const testSequence = [1,2,2,2,1,3,2,1,2,2,2,1].map((v,i) => [i,v]);
  
  it("can compute smooth similarity matrices", () => {
    expect(getCosineSimilarity([1],[1])).toBe(1);
    expect(getCosineSimilarity([0],[1])).toBe(0);
    expect(getCosineSimilarity([3],[1])).toBe(1);
    
    console.log(getSelfSimilarityMatrix([[0],[1],[0]], false))
    
    expect(getSelfSimilarityMatrix([[0],[0],[1],[1]], true))
      .toEqual([[1,1,0,0],[1,1,0,0],[0,0,1,1],[0,0,1,1]]);
    expect(getSelfSimilarityMatrix([[2],[2],[1],[1]], false))
      .toEqual([[1,1,1,1],[1,1,1,1],[1,1,1,1],[1,1,1,1]]);
    expect(getSelfSimilarityMatrix([[1],[1],[0],[0]], false))
      .toEqual([[1,1,0,0],[1,1,0,0],[0,0,1,1],[0,0,1,1]]);
    expect(getSelfSimilarityMatrix([[1],[1],[0],[0]], true, 1))
      .toEqual([[1,0.5,0,0],[0.5,1,1,0],[0,1,1,0.5],[0,0,0.5,1]]);
  });
  
  it("can calculate alignments", () => {
    expect(getDiagonalIndexPairs([[0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]]))
      .toEqual([[[4,0]],[[3,0],[4,1]],[[2,0],[3,1],[4,2]],[[1,0],[2,1],[3,2]],
        [[0,0],[1,1],[2,2]],[[0,1],[1,2]],[[0,2]]]);
    expect(getNonzeroDiagonalSegments([[0,1,1],[0,0,1],[0,0,0],[0,1,0],[0,0,1]]))
      .toEqual([[[3,1],[4,2]],[[0,1],[1,2]],[[0,2]]]);
    console.log(JSON.stringify(getSimilarityAlignment(testSequence, {
      minSegmentLength: 3}, testSequence)))
  });

});