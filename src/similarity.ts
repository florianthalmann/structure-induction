import * as math from 'mathjs'

export module Similarity {

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
		return this.getCosineSimilarity(vector, unitVector);
	}

	export function getCosineSimilarities(vectorMap) {
		var similarities = {};
		for (var uri1 in vectorMap) {
			for (var uri2 in vectorMap) {
				if (uri1 < uri2) {
					if (!similarities[uri1]) {
						similarities[uri1] = {};
					}
					similarities[uri1][uri2] = this.getCosineSimilarity(vectorMap[uri1], vectorMap[uri2]);
				}
			}
		}
		return similarities;
	}

	export function getCosineSimilarity(v1, v2) {
		if (v1.length == v2.length) {
			return math.dot(v1, v2)/(math.norm(v1)*math.norm(v2));
		}
		return 0;
	}

}