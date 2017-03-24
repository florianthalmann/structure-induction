import * as _ from 'lodash'

export module HEURISTICS {

	export interface CosiatecHeuristic {
		(pattern: number[][], vectors: number[][], occurrences: number[][][], allPoints: number[][]): number;
	}

	export let POINT_COUNT: CosiatecHeuristic = function(pattern: number[][], vectors: number[][], occurrences: number[][][], allPoints: number[][]) {
		return pattern.length;
	}

	export let COVERAGE: CosiatecHeuristic = function(pattern: number[][], vectors: number[][], occurrences: number[][][], allPoints: number[][]) {
		var stringOcc = occurrences.map(occ => occ.map(p => JSON.stringify(p)));
		var uniquePoints = _.uniq(_.flatten(stringOcc));
		return uniquePoints.length / allPoints.length;
	}

	export let COMPACTNESS: CosiatecHeuristic = function(pattern: number[][], vectors: number[][], occurrences: number[][][], allPoints: number[][]) {
		return 1 / getPointsInBoundingBox(pattern, allPoints).length;
	}

	export let COMPACTNESS2: CosiatecHeuristic = function(pattern: number[][], vectors: number[][], occurrences: number[][][], allPoints: number[][]) {
		return 1 / (1 + getPointsInBoundingBox(pattern, allPoints).length - pattern.length);
	}

	function getPointsInBoundingBox(pattern: number[][], allPoints: number[][]) {
		var maxes = _.zip(...pattern).map(c => _.max(c));
		var mins = _.zip(...pattern).map(c => _.min(c));
		return allPoints.filter(p => p.every((e,i) => maxes[i] - mins[i] == 0 || (mins[i] <= e && e <= maxes[i])));
	}

}