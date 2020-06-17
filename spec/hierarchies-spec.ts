import { loadJson } from '../src/util';
import { inferHierarchyFromMatrix, keepNBestSegments, rateHierarchy } from '../src/hierarchies';

describe("hierarchies", () => {
  
  const testMatrix = loadJson<number[][]>('spec/test-matrix.json');

  it("can find optimal groupings", () => {
    const threeLongest = keepNBestSegments(testMatrix, 3);
    
    expect(rateHierarchy(inferHierarchyFromMatrix(threeLongest))).toBe(170);
    
    expect(rateHierarchy(inferHierarchyFromMatrix(testMatrix))).toBe(206);
  });

});