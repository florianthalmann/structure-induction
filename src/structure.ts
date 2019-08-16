import * as _ from 'lodash'
import * as math from 'mathjs'
import { Quantizer, ArrayMap } from './quantizer'
import { opsiatec, getSiatec, OpsiatecOptions } from './opsiatec'
import { SmithWatermanOptions, getSmithWatermanOccurrences } from './sw-structure';
import { pointsToIndices } from './util';

export type Point = number[];
export type PointSet = Point[];
export type Vector = number[];
export type Occurrence = Point[];

export interface Pattern {
  points: PointSet,
  vectors: Vector[],
  occurrences: Occurrence[]
}

export interface StructureResult {
  points: Point[],
  patterns: Pattern[]
}

export interface CacheableStructureOptions {
  quantizerFunctions: ArrayMap[],
  cacheDir?: string,
  loggingLevel?: number
}

interface CosiatecIndexResult {
  occurrences: number[][][],
  numSiatecPatterns: number,
  numOptimizedPatterns: number
}

//returns patterns of indices in the original point sequence
export function getCosiatecIndexOccurrences(points: number[][], options: OpsiatecOptions): CosiatecIndexResult {
  const quantizedPoints = getQuantizedPoints(points, options.quantizerFunctions);
  //get the indices of the points involved
  const result = opsiatec(quantizedPoints, options);
  const occurrences = result.patterns.map(p => p.occurrences);
  const indexOccs = pointsToIndices(occurrences, quantizedPoints);
  indexOccs.forEach(p => p.map(o => o.sort((a,b) => a-b)));
  return {
    occurrences: indexOccs,
    numSiatecPatterns: result.numSiatecPatterns,
    numOptimizedPatterns: result.numOptimizedPatterns
  }
}

//returns occurrences of patterns in the original point sequence
export function getCosiatecOccurrences(points: number[][], options: OpsiatecOptions) {
  return getCosiatec(points, options).patterns.map(p => p.occurrences);
}

export function getCosiatec(points: number[][], options: OpsiatecOptions) {
  return opsiatec(getQuantizedPoints(points, options.quantizerFunctions), options);
}

export function getSiatecOccurrences(points: number[][], options: OpsiatecOptions) {
  return getSiatec(getQuantizedPoints(points, options.quantizerFunctions), options)
    .patterns.map(p => p.occurrences);
}

export function getSmithWaterman(points: number[][], options: SmithWatermanOptions) {
  /*let points = quantizedPoints.map(p => p.slice(0,3));
  return new SmithWaterman(null).run(points, points)[0];*/
  return getSmithWatermanOccurrences(getQuantizedPoints(points, options.quantizerFunctions), options);
}

function getQuantizedPoints(points: number[][], quantizerFuncs: ArrayMap[]) {
  const quantizer = new Quantizer(quantizerFuncs);
  const quantizedPoints = quantizer.getQuantizedPoints(points);
  return quantizedPoints;
}

export function getStructure(points: number[][], options: OpsiatecOptions, minPatternLength = 12) {
  const quantizedPoints = getQuantizedPoints(points, options.quantizerFunctions);
  let result = opsiatec(quantizedPoints, options);
  let occurrences =  result.patterns.map(p => p.occurrences);
  let vectors =  result.patterns.map(p => p.vectors);
  //only take patterns that are significantly large
  let patternSpans = occurrences.map(occ => getPatternSpan(occ[0]));
  //sort in ascending order by norm of translation vector
  let avgTsls = vectors.map(vs => math.mean(vs.map(v => Math.sqrt(math.sum(v.map(p => Math.pow(p,2)))))));
  [avgTsls, occurrences] = sortArraysByFirst(true, avgTsls, occurrences);
  //map onto point indices
  let occurrenceIndices = pointsToIndices(occurrences, quantizedPoints);
  //start with list of indices
  let structure = _.range(0, quantizedPoints.length);
  let paths = _.clone(structure).map(i => [i]);
  //[[0,1],[2,3,4],5,[6,[7,8]]]
  occurrenceIndices.forEach((occs,i) => {
    //take transposed if tsl < span/2
    if (avgTsls[i] < patternSpans[i]/2) {
      occs = _.zip(...occs);
    } else {
    //sort
    let minIndices = occs.map(occ => _.min(occ));
    let maxIndices = occs.map(occ => _.max(occ));
    [minIndices, maxIndices, occs] = sortArraysByFirst(true, minIndices, maxIndices, occs);
    //eliminate overlaps
    occs.forEach((occ,j) => {
      if (j+1 < occs.length) {
        if (maxIndices[j] >= minIndices[j+1]) {
          maxIndices[j] = minIndices[j+1]-1;
        }
      } else {
        //adjust last segment to be of same length as previous one
        maxIndices[j] = minIndices[j]+(maxIndices[j-1]-minIndices[j-1]);
      }
    });
    //see if all segments can be built
    let allSegmentsPossible = occs.every((occ,j) =>
      _.isEqual(_.initial(paths[minIndices[j]]), _.initial(paths[maxIndices[j]])));
    //start building
    //if (allSegmentsPossible) {
      console.log(JSON.stringify(_.zip(minIndices, maxIndices)));
      //iteratively build structure
      occs.forEach((occ,j) => {
        let minIndex = minIndices[j];
        let maxIndex = maxIndices[j];
        //make pattern smaller to fit
        while (!_.isEqual(_.initial(paths[minIndex]), _.initial(paths[maxIndex]))) {
          if (paths[minIndex].length >= paths[maxIndex].length) {
            minIndex++;
          } else if (paths[minIndex].length <= paths[maxIndex].length) {
            maxIndex--;
          }
        }
        if (_.isEqual(_.initial(paths[minIndex]), _.initial(paths[maxIndex])) && maxIndex-minIndex > 0) {
          let parentPath = _.initial(paths[minIndex]);
          let parentSegment = getSegmentAtPath(structure, parentPath);
          let firstIndex = _.last(paths[minIndex]);
          let lastIndex = _.last(paths[maxIndex]);
          let elementIndices = _.range(firstIndex, lastIndex+1);
          let newSegment = elementIndices.map(e => parentSegment[e]);
          parentSegment.splice(firstIndex, lastIndex-firstIndex+1, newSegment);
          //update paths!
          _.range(minIndex, maxIndex+1).forEach(i => {
            paths[i] = parentPath.concat(firstIndex).concat(paths[i][parentPath.length]-firstIndex).concat(paths[i].slice(parentPath.length+1))
          });
          _.range(maxIndex+1, paths.length).forEach(i => {
            if (_.isEqual(paths[i].slice(0, parentPath.length), parentPath)) {
              paths[i][parentPath.length] -= newSegment.length-1
            }
          });
        }
        //console.log(JSON.stringify(paths))
      });
    //}
    }
  });
  console.log(JSON.stringify(structure));
  return structure;
}

function sortArraysByFirst(ascending: boolean, ref: number[], ...arrays: any[][])  {
  let zipped = _.zip(ref, ...arrays);
  zipped.sort((a,b) => ascending ? a[0] - b[0] : b[0] - a[0]);
  return _.unzip(zipped);
}

function getSegmentAtPath(structure, path: number[]) {
  path.forEach(i => structure = structure[i]);
  return structure;
}

function getPatternSpan(pattern: number[][]): number {
  return <number> math.norm(math.subtract(pattern[pattern.length-1], pattern[0]));
}