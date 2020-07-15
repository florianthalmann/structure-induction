import * as math from 'mathjs';
import * as _ from 'lodash';
import { getMedian } from './util';

export function getSelfSimilarityMatrix(vectors: number[][], equality?: boolean, smoothness = 0) {
	return getSimilarityMatrix(vectors, vectors, equality, smoothness);
}

export function getSimilarityMatrix(v1: number[][], v2: number[][], equality?: boolean, smoothness = 0) {
	const matrix = v1.map(v => v2.map(w =>
		equality ? (_.isEqual(v, w) ? 1 : 0) : getCosineSimilarity(v, w)));
	return smoothness ? smoothDiagonals(matrix, smoothness) : matrix;
}

//median filter with median of (level*2)+1
function smoothDiagonals(matrix: number[][], level = 1) {
	return matrix.map((x,i) => x.map((_y,j) =>
		getMedian(getDiagonal(matrix, [i-level, j-level], (level*2)+1))));
}

function getDiagonal(matrix: number[][], start: [number, number], length: number) {
	return _.range(0, length).map(k => [start[0]+k, start[1]+k])
		.filter(([i,j]) => 0 <= i && i < matrix.length && 0 <= j && j < matrix[0].length)
		.map(([i,j]) => matrix[i][j]);
}

//adds the given successor to the predecessor of the given uri in the given sequence
export function addSuccessorToPredecessorOf(uri, successor, sequence, store) {
	var index = sequence.indexOf(uri);
	if (index > 0) {
		var predecessorUri = sequence[index-1];
		store.addSuccessor(predecessorUri, successor);
	}
}

export function addSimilaritiesAbove(store, similarities, threshold) {
	for (var uri1 in similarities) {
		for (var uri2 in similarities[uri1]) {
			//console.log(similarities[uri1][uri2])
			if (similarities[uri1][uri2] > threshold) {
				store.addSimilar(uri1, uri2);
				store.addSimilar(uri2, uri1);
			}
		}
	}
}

export function addHighestSimilarities(store, similarities, count) {
	//gather all similarities in an array
	var sortedSimilarities = [];
	for (var uri1 in similarities) {
		for (var uri2 in similarities[uri1]) {
			sortedSimilarities.push([similarities[uri1][uri2], uri1, uri2]);
		}
	}
	//sort in descending order
	sortedSimilarities = sortedSimilarities.sort((a,b) => b[0] - a[0]);
	//console.log(sortedSimilarities.map(s => s[0]))
	//add highest ones to dymos
	for (var i = 0, l = Math.min(sortedSimilarities.length, count); i < l; i++) {
		var sim = sortedSimilarities[i];
		store.addSimilar(sim[1], sim[2]);
		store.addSimilar(sim[2], sim[1]);
	}
}

export function reduce(vector) {
	var unitVector = Array.apply(null, Array(vector.length)).map(Number.prototype.valueOf, 1);
	return getCosineSimilarity(vector, unitVector);
}

export function getCosineSimilarities(vectorMap) {
	var similarities = {};
	for (var uri1 in vectorMap) {
		for (var uri2 in vectorMap) {
			if (uri1 < uri2) {
				if (!similarities[uri1]) {
					similarities[uri1] = {};
				}
				similarities[uri1][uri2] = getCosineSimilarity(vectorMap[uri1], vectorMap[uri2]);
			}
		}
	}
	return similarities;
}

export function getCosineSimilarity(v1: number[], v2: number[]) {
	if (v1.length == v2.length) {
		if (v1.every(x => x == 0) && v2.every(x => x == 0)) return 1;
		const similarity = math.dot(v1, v2)/(math.norm(v1)*math.norm(v2));
		if (similarity) return similarity; //0 if one of vectors zero-vector...
	}
	return 0;
}
