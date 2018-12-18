import * as _ from 'lodash'

export module HEURISTICS {

	export interface CosiatecHeuristic {
		(pattern: number[][], vectors: number[][], occurrences: number[][][], allPoints: number[][]): number;
	}

	/**number of points in pattern*/
	export const POINT_COUNT: CosiatecHeuristic = function(pattern: number[][], vectors: number[][], occurrences: number[][][], allPoints: number[][]) {
		return pattern.length;
	}

	/**proportion of points in composition covered by pattern*/
	export const COVERAGE: CosiatecHeuristic = function(pattern: number[][], vectors: number[][], occurrences: number[][][], allPoints: number[][]) {
		var stringOcc = occurrences.map(occ => occ.map(p => JSON.stringify(p)));
		var uniquePoints = _.uniq(_.flatten(stringOcc));
		return uniquePoints.length / allPoints.length;
	}
	
	/**proportion of points in pattern bounding box involved in pattern*/
	export const COMPACTNESS: CosiatecHeuristic = function(pattern: number[][], vectors: number[][], occurrences: number[][][], allPoints: number[][]) {
		return pattern.length / getPointsInBoundingBox(pattern, allPoints).length;
	}

	/**proportion of points in pattern bounding box involved in pattern*/
	export const SIZE_AND_COMPACTNESS: CosiatecHeuristic = function(pattern: number[][], vectors: number[][], occurrences: number[][][], allPoints: number[][]) {
		return pattern.length * pattern.length / getPointsInBoundingBox(pattern, allPoints).length;
	}

	export function getPointsInBoundingBox(pattern: number[][], allPoints: number[][]) {
		var maxes = _.zip(...pattern).map(c => _.max(c));
		var mins = _.zip(...pattern).map(c => _.min(c));
		//console.log("BOUNDING", pattern, allPoints, mins, maxes, allPoints.filter(p => p.every((e,i) => (mins[i] <= e && e <= maxes[i]))))
		return allPoints.filter(p => p.every((e,i) => mins[i] <= e && e <= maxes[i]));
	}

}