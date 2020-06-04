import { getMultiSWOccurrences } from '../src/sw-structure';

describe("smith waterman", () => {

  const sequence = [1,2,2,2,1,3,2,1,2,2,2,1].map((v,i) => [i,v]);

  it("can find repeating patterns", () => {
    let results = getMultiSWOccurrences(sequence, sequence, {
      onlyDiagonals: true, minSegmentLength: 3});
    expect(results.patterns.length).toBe(1);
    expect(results.patterns.map(p => p.points.length)).toEqual([5]);
    expect(results.patterns[0].occurrences).toEqual(
      [[[7,1],[8,2],[9,2],[10,2],[11,1]],[[0,1],[1,2],[2,2],[3,2],[4,1]]]);
    results = getMultiSWOccurrences(sequence, sequence, {
      onlyDiagonals: true, minSegmentLength: 2, minDistance: 2});
    expect(results.patterns.length).toBe(3);
    expect(results.patterns.map(p => p.points.length)).toEqual([5,2,2]);
    results = getMultiSWOccurrences(sequence, sequence, {
      onlyDiagonals: true, minSegmentLength: 2, minDistance: 1});
    expect(results.patterns.length).toBe(7);
    expect(results.patterns.map(p => p.points.length)).toEqual([5,2,2,2,2,2,2]);
    const sequence2 = [1,2,2,2,1,3,3,2,1,2,2,2,1].map((v,i) => [i,v]);
    results = getMultiSWOccurrences(sequence, sequence2, {
      onlyDiagonals: false, nLongest: 1});
    expect(results.patterns.length).toBe(1);
    expect(results.patterns.map(p => p.points.length)).toEqual([12]);
  });

});