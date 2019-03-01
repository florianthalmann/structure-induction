import * as _ from 'lodash';
import { SiatecPattern } from './siatec';

export interface CosiatecHeuristic {
	(pattern: SiatecPattern, allPoints: number[][]): number;
}

export module HEURISTICS {

	/**number of points in pattern*/
	export const POINT_COUNT: CosiatecHeuristic = function(pattern: SiatecPattern, allPoints: number[][]) {
		return pattern.points.length;
	}

	/**proportion of points in composition covered by pattern*/
	export const COVERAGE: CosiatecHeuristic = function(pattern: SiatecPattern, allPoints: number[][]) {
		var stringOcc = pattern.occurrences.map(occ => occ.map(p => JSON.stringify(p)));
		var uniquePoints = _.uniq(_.flatten(stringOcc));
		return uniquePoints.length / allPoints.length;
	}
	
	/**proportion of points in pattern bounding box involved in pattern*/
	export const COMPACTNESS: CosiatecHeuristic = function(pattern: SiatecPattern, allPoints: number[][]) {
		return pattern.points.length
			/ getPointsInBoundingBox(pattern.points, allPoints).length;
	}

	/**proportion of points in pattern bounding box involved in pattern*/
	export const SIZE_AND_COMPACTNESS: CosiatecHeuristic = function(pattern: SiatecPattern, allPoints: number[][]) {
		return Math.pow(pattern.points.length, 1.8)
			/ getPointsInBoundingBox(pattern.points, allPoints).length;
	}
	
	export const SIZE_AND_1D_COMPACTNESS = function(dimIndex: number, power = 1.8): CosiatecHeuristic {
		return (pattern: SiatecPattern, allPoints: number[][]) =>
			Math.pow(pattern.points.length, power)
				/ getPointsInBoundingBox(pattern.points, allPoints, dimIndex).length;
	}
	
	export const SIZE_1D_COMPACTNESS_AND_REGULARITY = function(dimIndex: number, power = 1.8) {
		return (pattern: SiatecPattern, allPoints: number[][]) =>
			Math.pow(pattern.points.length, power)
				* getVectorsRegularity(pattern.vectors, dimIndex)
				/ getPointsInBoundingBox(pattern.points, allPoints, dimIndex).length;
	}

	export const SIZE_AND_1D_COMPACTNESS_AXIS = function(dimIndex: number, power = 1.8): CosiatecHeuristic {
		return (pattern: SiatecPattern, allPoints: number[][]) =>
			Math.pow(pattern.points.length, power)
				/ getPointsInBoundingBox(pattern.points, allPoints, dimIndex).length
				* getAxisParallelism(pattern.vectors, dimIndex);
	}
	
	function getVectorsRegularity(vectors: number[][], dimIndex: number) {
		return _.reduce(vectors.map(v =>
			(v[dimIndex] % 2 == 0 ? 2 : 1) * (v[dimIndex] % 4 == 0 ? 2 : 1)
		), _.multiply);
	}
	
	// 1 if all vectors are on the axis of the given dimension
	function getAxisParallelism(vectors: number[][], dimIndex: number) {
		return _.reduce(vectors.map(v =>
			v.every((d,i) => i == dimIndex || d == 0) ? 1 : 0), _.multiply);
	}

	export function getPointsInBoundingBox(pattern: number[][], allPoints: number[][], dimIndex?: number) {
		var maxes = _.zip(...pattern).map(c => _.max(c));
		var mins = _.zip(...pattern).map(c => _.min(c));
		if (dimIndex != null) {
			return allPoints.filter(p => mins[dimIndex] <= p[dimIndex] && p[dimIndex] <= maxes[dimIndex]);
		}
		return allPoints.filter(p => p.every((e,i) => mins[i] <= e && e <= maxes[i]));
	}

}