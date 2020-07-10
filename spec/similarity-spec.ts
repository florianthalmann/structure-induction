import { loadJson } from '../src/util';
import { getCosineSimilarity, getSelfSimilarityMatrix } from '../src/similarity';

describe("similarity", () => {
  
  const testMatrix = loadJson<number[][]>('spec/data/test-matrix.json');
  const testSequence = loadJson<string[]>('spec/data/test-sequence.json');
  
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
    expect(getSelfSimilarityMatrix([[1],[1],[0],[0]], true, true))
      .toEqual([[1,0.5,0,0],[0.5,1,1,0],[0,1,1,0.5],[0,0,0.5,1]]);
  });

});