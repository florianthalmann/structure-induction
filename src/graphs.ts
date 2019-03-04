import * as _ from 'lodash';
import { SiatecResult } from './siatec';
import { pointsToIndices } from './util';

export function getConnectednessRatings(siatecResult: SiatecResult) {
  const numPoints = siatecResult.points.length;
  const connections = _.times(numPoints, () => _.times(numPoints, _.constant(0)));
  const occurrences = siatecResult.patterns.map(p => p.occurrences);
  const indexOccs = pointsToIndices(occurrences, siatecResult.points);
  indexOccs.forEach(o =>
    //increase the connection matrix values for all pairs of associated points
    _.zip(...o).forEach(t => allPairs(t).forEach(p => {
      connections[p[0]][p[1]]++;
      connections[p[1]][p[0]]++;
    }))
  );
  return connections;
}

function allPairs(nums: number[]): number[][] {
  return _.flatten(nums.map((n,i) =>
    nums.filter((_,j) => j > i).map(m => [n, m])));
}