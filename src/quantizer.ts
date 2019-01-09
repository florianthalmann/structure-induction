import * as _ from 'lodash'
import * as clusterfck from 'clusterfck'
import { indicesOfNMax } from 'arrayutils'

export const QUANT_FUNCS = {
	IDENTITY: identity,
	CONSTANT: getConstant,
	ROUND: getRound,
	ORDER: getOrder,
	SUMMARIZE: getSummarize,
	SORTED_SUMMARIZE: getSortedSummarize,
	TRANSP_SORTED_SUMMARIZE: getTransposedSortedSummarize,
	DISCRETIZE: getDiscretize,
	CLUSTER: getCluster,
	SCALE: scale,
	NORMALIZE: normalize,
	INTERVALS: toIntervals
}

type twoDArray = number|number[];

/** maps over arrays of values */
export interface ArrayMap {
	(values: (number|number[])[]): (number|number[])[];
}

function identity(): ArrayMap {
	return toArrayMap(x => x);
}

/** maps all values of an array to the given constant */
function getConstant(value: number): ArrayMap {
	return toArrayMap(() => value);
}

/** returns a function that rounds all numbers in an array to the given precision */
function getRound(precision: number = 2): ArrayMap {
	return toArrayMap(_.curryRight<number,number,number>(_.round)(precision));
}

/** returns a function that maps all numbers in an array onto their index */
function getOrder(): ArrayMap {
	return (values: number[]) => values.map((v,i) => i);
}

/** returns a function that maps all arrays in an array onto the outDims highest values */
function getSummarize(outDims: number): ArrayMap {
	return toMatrixMap(_.curryRight<number[],number,number[]>(indicesOfNMax)(outDims));
}

/** returns a function that summarizes and sorts the arrays of an array */
function getSortedSummarize(outDims: number): ArrayMap {
	return _.flow(getSummarize(outDims), sort);
}

//TODO IS NOT REALLY SET CLASS YET, NEED TO INVERT POTENTIALLY!!
function getTransposedSortedSummarize(outDims: number): ArrayMap {
	return _.flow(getSummarize(outDims), sort, toMatrixMap(toIntervals));
}

/** returns a function that maps all numbers in an array onto a discrete segment [0,...,numValues-1] */
function getDiscretize(numValues: number): ArrayMap {
	return _.flow(scale, _.curryRight(multiply)(numValues), toArrayMap(_.round));
}

function getCluster(numClusters: number): ArrayMap {
	return _.curryRight(cluster)(numClusters);
}

/** scales all values in an array to [0,1] */
function scale(values: number[]): number[] {
	var max = _.max(values);
	var min = _.min(values);
	return values.map(v => (v-min)/(max-min));
}

/** normalizes all values in an array */
function normalize(values: number[]): number[] {
	var mean = _.mean(values);
	var std = std(values, mean);
	return values.map(v => (v-mean)/std);
}

/** maps all values onto the interval by which they are reached */
function toIntervals(values: number[]): number[] {
	return values.map((v,i) => i>0 ? v-values[i-1] : 0);
}

/** clusters all values and maps them onto their cluster index */
function cluster(values: number[][], clusterCount: number): number[] {
	var kmeans = new clusterfck.Kmeans(null);
	var clusters = kmeans.cluster(values, clusterCount, null, null, null);
	return values.map(v => kmeans.classify(v, null));
}

function multiply(values: number[], multiplier: number): number[] {
	return values.map(v => v*multiplier);
}

function sort(values: number[][]): number[][] {
	return values.map(v => _.sortBy(v));
}

function std(values: number[], mean: number): number {
	return Math.sqrt(_.sum(values.map(v => Math.pow((v - mean), 2))) / values.length);
}

function toArrayMap(func: (x:number)=>number): ArrayMap {
	return (values: number[]) => values.map(v => func(v));
}

function toMatrixMap(func: (x:number[])=>number[]): ArrayMap {
	return (values: number[][]) => values.map(v => func(v));
}

export class Quantizer {

	private dimFuncs: ArrayMap[];

	constructor(dimFuncs: ArrayMap[]) {
		this.dimFuncs = dimFuncs;
	}

	getQuantizedPoints(points: (number|number[])[][]): number[][] {
		if (this.dimFuncs.length > 0) {
			points = this.dimFuncs.map((f,i) => f(points.map(p => p[i])));
			points = _.zip(...points);
		}
		return points.map(p => _.flatten(p));
	}

	roundPoint(point, precision) {
		return point.map(x => _.round(x, precision));
	}

	/**
	 * TODO WHERE TO PUT?
	 * returns a map with a normalized vector for each given dymo. if reduce is true, multidimensional ones are reduced
	 */
	normalize(vectors: number[][]): number[][] {
		//normalize the space
		var means = [];
		var vars = [];
		for (var i = 0; i < vectors[0].length; i++) {
			var currentDim = [];
			for (var j = 0; j < vectors.length; j++) {
				if (!isNaN(vectors[j][i])) {
					currentDim.push(vectors[j][i]);
				}
			}
			means[i] = _.mean(currentDim);
			vars[i] = std(currentDim, means[i]);
		}
		return vectors.map(v => v.map((e,i) => (e-means[i])/vars[i]));
	}

}