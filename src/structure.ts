import * as _ from 'lodash'
import * as math from 'mathjs'
import { indexOfMax } from 'arrayutils';
import { Quantizer, ArrayMap } from './quantizer'
import { opsiatec, getSiatec, OpsiatecOptions, OpsiatecResult } from './opsiatec'
import { SmithWaterman, SmithWatermanResult, TRACES } from './smith-waterman'
import { pointsToIndices } from './util';

export interface IterativeSmithWatermanResult {
  segments: number[][][],
  matrices: SmithWatermanResult[],
  segmentMatrix: number[][],
}

export interface StructureOptions extends OpsiatecOptions {
  quantizerFunctions: ArrayMap[]
}

interface CosiatecIndexResult {
  occurrences: number[][][],
  numSiatecPatterns: number,
  numOptimizedPatterns: number
}

export class StructureInducer {

  private quantizedPoints: number[][];

  constructor(private originalPoints: number[][], private options: StructureOptions) {
    this.quantizePoints();
  }
  
  quantizePoints() {
    const quantizerFuncs = this.options ? this.options.quantizerFunctions : [];
    const quantizer = new Quantizer(quantizerFuncs);
    this.quantizedPoints = quantizer.getQuantizedPoints(this.originalPoints);
    if (this.options.loggingLevel > 1) {
      console.log("quantized points:", JSON.stringify(this.quantizedPoints));
    }
  }

  //returns patterns of indices in the original point sequence
  getCosiatecIndexOccurrences(): CosiatecIndexResult {
    //get the indices of the points involved
    const result = opsiatec(this.quantizedPoints, this.options);
    const occurrences = result.patterns.map(p => p.occurrences);
    const indexOccs = pointsToIndices(occurrences, this.quantizedPoints);
    indexOccs.forEach(p => p.map(o => o.sort((a,b) => a-b)));
    return {
      occurrences: indexOccs,
      numSiatecPatterns: result.numSiatecPatterns,
      numOptimizedPatterns: result.numOptimizedPatterns
    }
  }

  //returns occurrences of patterns in the original point sequence
  getCosiatecOccurrences() {
    return opsiatec(this.quantizedPoints, this.options)
      .patterns.map(p => p.occurrences);
  }
  
  getSiatecOccurrences() {
    return getSiatec(this.quantizedPoints, this.options)
      .patterns.map(p => p.occurrences);
  }

  getSmithWaterman() {
    let points = this.quantizedPoints.map(p => p.slice(0,3));
    return new SmithWaterman(null).run(points, points)[0];
  }

  /*getSmithWatermanOccurrences(options): number[][][] {
    let points = this.quantizedPoints.map(p => p.slice(0,3));
    let result = new SmithWaterman().run(points, points);
    let sw = result.scoreMatrix;
    let trace = result.traceMatrix;
    //make lower matrix 0
    sw = sw.map((r,i) => r.map((c,j) => j < i ? 0 : c));
    var max: number, i: number, j: number;
    [i, j, max] = this.getIJAndMax(sw);
    var segments: number[][][] = [];
    while (max > options.maxThreshold) {
      //find ij trace in matrix
      let currentValue = max;
      let currentTrace = trace[i][j];
      let currentSegments = [[i],[j]];
      while (currentValue > options.endThreshold) {
        //reset current location in matrix
        sw[i][j] = 0;//-= 3;
        if (currentTrace === TRACES.DIAGONAL) {
          [i,j] = [i-1,j-1];
        } else if (currentTrace === TRACES.UP) {
          [i,j] = [i-1,j];
        } else if (currentTrace === TRACES.LEFT) {
          [i,j] = [i,j-1];
        } else {
          break;
        }
        currentSegments[0].push(i);
        currentSegments[1].push(j);
        currentValue = sw[i][j];
        currentTrace = trace[i][j];
      }

      //sort ascending
      currentSegments.forEach(o => o.sort((a,b) => a-b));
      //remove duplicates
      currentSegments = currentSegments.map(occ => _.uniq(occ));

      //let allPoints = _.union(_.flatten(segments.map(s => _.union(...s))));
      //let newPoints = currentSegments.map(occ => _.difference(occ, allPoints));
      //only add if longer than minSegmentLength
      if (currentSegments[0].length > options.minSegmentLength && currentSegments[1].length > options.minSegmentLength) { //(newPoints[0].length > minSegmentLength && newPoints[1].length > minSegmentLength) {
        //TODO ONLY ADD IF DIFFERENCE FROM EXISTING ONES SMALL ENOUGH!!!!!
        segments.push(currentSegments);
      }
      let ijMax = this.getIJAndMax(sw);
      i = ijMax[0];
      j = ijMax[1];
      max = ijMax[2];
    }
    //filter out wanted segments
    if (options.patternIndices) {
      segments = segments.filter((s,i) => options.patternIndices.indexOf(i) >= 0);
    }
    console.log(JSON.stringify(segments));
    return segments;
  }*/

  private getAdjustedSWMatrices(similarityThreshold: number, result: IterativeSmithWatermanResult, ignoredPoints?) {
    //TODO MAKE SURE NO SLICING NEEDS TO HAPPEN (JUST RUN WITH COLLAPSED TEMPORAL FEATURES??)
    let points = this.quantizedPoints.map(p => p.slice(0,p.length-1));
    let matrices = new SmithWaterman(similarityThreshold).run(points, points, ignoredPoints);
    result.matrices.push(_.clone(matrices));
    //make lower matrix 0
    matrices.scoreMatrix = matrices.scoreMatrix.map((r,i) => r.map((c,j) => j < i ? 0 : c));
    return matrices;
  }

  /**
   * relevant options are: iterative, similarityThreshold, maxThreshold, endThreshold, minSegmentLength, patternIndices
   */
  getSmithWatermanOccurrences(options): IterativeSmithWatermanResult {
    let result: IterativeSmithWatermanResult = {segments:[], matrices:[], segmentMatrix:[]};
    let matrices = this.getAdjustedSWMatrices(options.similarityThreshold, result);
    var max: number, i: number, j: number;
    [i, j, max] = this.getIJAndMax(matrices.scoreMatrix);
    var allSelectedPoints: number[][] = [];

    while (max > options.maxThreshold) {
      let currentPoints = this.getAlignment(matrices, i, j, options.endThreshold, options.onlyDiagonals);
      let currentSegments = this.toSegments(currentPoints);

      //only add if longer than minSegmentLength
      if (currentSegments[0].length > options.minSegmentLength && currentSegments[1].length > options.minSegmentLength) {
        let dist = currentSegments[1][0]-currentSegments[0][0];
        console.log("current max: " + max, "current dist: " + dist, "\ncurrent points: " + JSON.stringify(currentPoints), "\ncurrent segments: " + JSON.stringify(currentSegments));
        //TODO ONLY ADD IF DIFFERENCE FROM EXISTING ONES SMALL ENOUGH!!!!!
        result.segments.push(currentSegments);
        //add reflections at diagonal
        currentPoints = currentPoints.concat(currentPoints.map(p => _.reverse(_.clone(p))));
        allSelectedPoints = allSelectedPoints.concat(currentPoints);
        if (options.iterative) {
          matrices = this.getAdjustedSWMatrices(options.similarityThreshold, result, allSelectedPoints);
        }
      }
      [i, j, max] = this.getIJAndMax(matrices.scoreMatrix);
    }
    //filter out requested segments (via patternIndices)
    if (options.patternIndices) {
      result.segments = result.segments.filter((s,i) => options.patternIndices.indexOf(i) >= 0);
    }
    result.segmentMatrix = this.createPointMatrix(allSelectedPoints);
    return result;
  }

  createPointMatrix(points: number[][]): number[][] {
    let maxIndex = math.max(points);
    let row = _.fill(new Array(maxIndex+1), 0);
    let matrix = row.map(m => _.fill(new Array(maxIndex+1), 0));
    points.forEach(p => matrix[p[0]][p[1]] = 1);
    return matrix;
  }

  createSegmentMatrix(segments: number[][][]): number[][] {
    let maxIndex = math.max(segments);
    let row = _.fill(new Array(maxIndex+1), 0);
    let matrix = row.map(m => _.fill(new Array(maxIndex+1), 0));
    segments.forEach(s => s[0].forEach((s0,i) => matrix[s0][s[1][i]] = 1));
    return matrix;
  }

  private getAlignment(matrices, i, j, endThreshold?: number, onlyDiagonals?: boolean): number[][] {
    //find ij trace in matrix
    let currentValue = matrices.scoreMatrix[i][j];
    let currentTrace = matrices.traceMatrix[i][j];
    let pointsOnAlignment = [[i,j]];
    while (currentValue > endThreshold) {
      //reset current location in matrix
      //TODO DONT NEED DO THIS!!!!!
      matrices.scoreMatrix[i][j] = 0;//-= 3;
      if (currentTrace === TRACES.DIAGONAL) {
        [i,j] = [i-1,j-1];
      } else if (currentTrace === TRACES.UP && !onlyDiagonals) {
        [i,j] = [i-1,j];
      } else if (currentTrace === TRACES.LEFT && !onlyDiagonals) {
        [i,j] = [i,j-1];
      } else {
        break;
      }
      pointsOnAlignment.push([i,j]);
      currentValue = matrices.scoreMatrix[i][j];
      currentTrace = matrices.traceMatrix[i][j];
    }
    return pointsOnAlignment;
  }

  private toSegments(alignmentPoints: number[][]) {
    let currentSegments = _.zip(...alignmentPoints);
    //sort ascending
    currentSegments.forEach(o => o.sort((a,b) => a-b));
    //remove duplicates
    return currentSegments.map(occ => _.uniq(occ));
  }

  private getIJAndMax(matrix: number[][]): number[] {
    let ijAndMaxes = matrix.map((row,i) => [i].concat(this.getIAndMax(row)));
    let index = indexOfMax(ijAndMaxes.map(m => m[2]));
    return ijAndMaxes[index];
  }

  private getIAndMax(array: number[]): number[] {
    let iAndMax = [-1, 0];
    array.forEach((x, i) => { if (x > iAndMax[1]) iAndMax = [i, x] });
    return iAndMax;
  }

  getStructure(minPatternLength = 12) {
    let result = opsiatec(this.quantizedPoints, this.options);
    let occurrences =  result.patterns.map(p => p.occurrences);
    let vectors =  result.patterns.map(p => p.vectors);
    //only take patterns that are significantly large
    let patternSpans = occurrences.map(occ => this.getPatternSpan(occ[0]));
    //sort in ascending order by norm of translation vector
    let avgTsls = vectors.map(vs => math.mean(vs.map(v => Math.sqrt(math.sum(v.map(p => Math.pow(p,2)))))));
    [avgTsls, occurrences] = this.sortArraysByFirst(true, avgTsls, occurrences);
    //map onto point indices
    let occurrenceIndices = pointsToIndices(occurrences, this.quantizedPoints);
    //start with list of indices
    let structure = _.range(0, this.quantizedPoints.length);
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
      [minIndices, maxIndices, occs] = this.sortArraysByFirst(true, minIndices, maxIndices, occs);
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
            let parentSegment = this.getSegmentAtPath(structure, parentPath);
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

  private sortArraysByFirst(ascending: boolean, ref: number[], ...arrays: any[][])  {
    let zipped = _.zip(ref, ...arrays);
    zipped.sort((a,b) => ascending ? a[0] - b[0] : b[0] - a[0]);
    return _.unzip(zipped);
  }

  private getSegmentAtPath(structure, path: number[]) {
    path.forEach(i => structure = structure[i]);
    return structure;
  }

  private getPatternSpan(pattern: number[][]): number {
    return <number> math.norm(math.subtract(pattern[pattern.length-1], pattern[0]));
  }

}