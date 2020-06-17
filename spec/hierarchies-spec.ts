import * as _ from 'lodash';
import { loadJson } from '../src/util';
import { getNBestSegments, segmentsToMatrix,
  getHierarchicalSegmentations, constructHierarchyFromSegmentations,
  rateHierarchy } from '../src/hierarchies';

describe("hierarchies", () => {
  
  const testMatrix = loadJson<number[][]>('spec/test-matrix.json');

  it("can find optimal groupings", () => {
    const threeLongest = segmentsToMatrix(getNBestSegments(testMatrix, 3),
      [testMatrix.length, testMatrix[0].length]);
    
    /*const hierarchicalMatrix = removeAlignmentMatrixOverlaps(threeLongest);
    console.log(countNonzero(threeLongest), countNonzero(hierarchicalMatrix));*/
    
    /*const seg = getFirstHierarchicalSegmentation(threeLongest);
    const hierarchy = constructHierarchyFromSegmentations(seg, threeLongest.length);
    console.log(JSON.stringify(hierarchy))*/
    
    const segs = getHierarchicalSegmentations(threeLongest);
    const hierarchies = segs.map(s =>
      constructHierarchyFromSegmentations(s, threeLongest.length));
    
    hierarchies.map(h => console.log(JSON.stringify(h)))
    
    const ratings = hierarchies.map(h => rateHierarchy(h));
    
    console.log(JSON.stringify(ratings));
    
    expect(_.max(ratings)).toBe(ratings[0]);
  });
  
  function countNonzero(matrix: number[][]) {
    return _.flatten(matrix).filter(v => v != 0).length;
  }

});