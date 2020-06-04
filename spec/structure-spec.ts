import * as _ from 'lodash';
import { siatec } from '../src/siatec';
import { cosiatec } from '../src/cosiatec';
import { Quantizer } from '../src/quantizer';
import { QUANT_FUNCS } from '../src/quantizer';
import { HEURISTICS } from '../src/heuristics';
import * as optimizer from '../src/optimizer';
import * as graphs from '../src/graphs';
import { toOrderedPointString } from '../src/util';

describe("a structure induction algorithm", function() {

	//example from figure 12 in meredith-lemström-wiggins 2003
	//dimensions reversed due to order reversing in easystore
	//points (4,3), (5,4) added to test iterative cosiatec
	var points = [[1,1],[1,3],[2,1],[2,2],[2,3],[3,2],[4,3],[5,4]];
	//4         x
	//3 x x   x
	//2   x x
	//1 x x 
	//. 1 2 3 4 5

	/*it ("can build a hierarchy from patterns", function() {
		var inducer = new StructureInducer(points);
		var structure = inducer.getStructure(0);
		expect(JSON.stringify(structure)).toEqual("[0,[1,2,3,4],[5,6],7]");
	});*/

	it("can find repeating geometric patterns", function() {
		
		var result = siatec(points);

		expect(result.patterns.length).toBe(6);
		expect(JSON.stringify(result.patterns.map(p=>p.points)))
			.toBe('[[[2,1],[2,2]],[[1,1],[2,1]],[[1,3]],[[1,1],[1,3],[2,2]],[[1,1],[2,1],[3,2],[4,3]],[[1,1],[2,2]]]');
		
		const COOLEST = 4;

		var occurrences = result.patterns.map(p => p.occurrences);
		expect(occurrences.length).toBe(6);
		expect(JSON.stringify(occurrences[COOLEST])).toBe('[[[1,1],[2,1],[3,2],[4,3]],[[2,2],[3,2],[4,3],[5,4]]]');
		//console.log(JSON.stringify(occurrences))

		var original = result.patterns[COOLEST];
		var minimized = optimizer.minimize(result, HEURISTICS.COMPACTNESS, 0).patterns[COOLEST];
		//console.log(JSON.stringify(minimized));
		expect(original.points.length).toBe(4);
		expect(minimized.points.length).toBe(2);
		expect(HEURISTICS.COMPACTNESS(original, points)).toBe(0.5714285714285714);
		expect(HEURISTICS.COMPACTNESS(minimized, points)).toBe(1);

		var divided = optimizer
			.dividePattern(original, points, 0, HEURISTICS.COMPACTNESS)
			.map(p => p.points);
		expect(JSON.stringify(divided)).toBe('[[[1,1]],[[2,1]],[[3,2],[4,3]]]');
		
		var partitioned = optimizer
			.partitionPattern(original, points, 0, HEURISTICS.COMPACTNESS);
		//all individual partitions due to vectors [[0,0],[1,1]]
		expect(JSON.stringify(partitioned.map(p => p.points))).toBe('[[[1,1]]]');
		expect(JSON.stringify(partitioned.map(p => p.vectors)))
			.toBe('[[[0,0],[1,0],[1,1],[2,1],[3,2],[4,3]]]');
		expect(JSON.stringify(partitioned.map(p => p.occurrences)))
			.toBe('[[[[1,1]],[[2,1]],[[2,2]],[[3,2]],[[4,3]],[[5,4]]]]');
		
		original.vectors = [[0,0],[2,0]];
		partitioned = optimizer
			.partitionPattern(original, points, 0, HEURISTICS.COMPACTNESS);
		//partition down the middle the best
		expect(JSON.stringify(partitioned.map(p => p.points)))
			.toBe('[[[1,1],[2,1]],[[3,2],[4,3]]]');
		expect(JSON.stringify(partitioned.map(p => p.vectors)))
			.toBe('[[[0,0],[2,0]],[[0,0],[2,0]]]');
		expect(JSON.stringify(partitioned.map(p => p.occurrences)))
			.toBe('[[[[1,1],[2,1]],[[3,1],[4,1]]],[[[3,2],[4,3]],[[5,2],[6,3]]]]');
		
		original.vectors = [[0,0],[3,0]];
		partitioned = optimizer
			.partitionPattern(original, points, 0, HEURISTICS.COMPACTNESS);
		//partition down the middle still heuristically the best
		expect(JSON.stringify(partitioned.map(p => p.points)))
			.toBe('[[[1,1],[2,1]],[[3,2],[4,3]]]');
		expect(JSON.stringify(partitioned.map(p => p.vectors)))
			.toBe('[[[0,0],[3,0]],[[0,0],[3,0]]]');
		expect(JSON.stringify(partitioned.map(p => p.occurrences)))
			.toBe('[[[[1,1],[2,1]],[[4,1],[5,1]]],[[[3,2],[4,3]],[[6,2],[7,3]]]]');
		
		const allMind = optimizer.minimize(result, HEURISTICS.COMPACTNESS, 0);
		expect(allMind.patterns.length).toBe(result.patterns.length);
		
		const allDivd = optimizer.divide(result, HEURISTICS.COMPACTNESS, 0);
		expect(allDivd.patterns.length).toBe(4);
		
		const allPartd = optimizer.partition(result, HEURISTICS.COMPACTNESS, 0);
		expect(allPartd.patterns.length).toBe(5);
		
		//original result should already be grouped correctly
		expect(optimizer.unitePatterns(result.patterns).length).toBe(6);
	});

	it("can select the best patterns", function() {
		//non-overlapping patterns
		var result = cosiatec(points, {selectionHeuristic: HEURISTICS.SIZE_AND_1D_COMPACTNESS(0)});
		var patterns = result.patterns.map(p => p.points);
		expect(JSON.stringify(patterns)).toEqual("[[[1,1],[2,1],[3,2],[4,3]],[[1,3]]]");

		//overlapping patterns
		result = cosiatec(points, {overlapping: true, selectionHeuristic: HEURISTICS.SIZE_AND_1D_COMPACTNESS(0)});
		patterns = result.patterns.map(p => p.points);
		expect(JSON.stringify(patterns)).toEqual("[[[1,1],[2,1],[3,2],[4,3]],[[1,1],[1,3],[2,2]]]");
		
		//subset
		result = cosiatec(points, {numPatterns: 1, overlapping: true, selectionHeuristic: HEURISTICS.SIZE_AND_1D_COMPACTNESS(0)});
		patterns = result.patterns.map(p => p.points);
		expect(JSON.stringify(patterns)).toEqual("[[[1,1],[2,1],[3,2],[4,3]]]");
		
		//additional patterns
		result = cosiatec(points, {numPatterns: 4, overlapping: true, selectionHeuristic: HEURISTICS.SIZE_AND_1D_COMPACTNESS(0)});
		patterns = result.patterns.map(p => p.points);
		expect(JSON.stringify(patterns)).toEqual("[[[1,1],[2,1],[3,2],[4,3]],[[1,1],[1,3],[2,2]],[[2,1],[2,2]],[[1,1],[2,1]]]");
	});

	it("has various different heuristics", function() {
		var result = siatec(points);

		var coverage = result.patterns.map(p => HEURISTICS.COVERAGE(p, points));
		expect(coverage).toEqual([0.375,0.75,1,0.75,0.75,0.75]);

		var compactness = result.patterns.map(p => HEURISTICS.COMPACTNESS(p, points));
		expect(compactness).toEqual([1,1,1,0.6,0.5714285714285714,0.6666666666666666]);
		
		var sizeComp = result.patterns.map(p => HEURISTICS.SIZE_AND_COMPACTNESS(p, points));
		expect(sizeComp).toEqual([1.7411011265922482,1.7411011265922482,1,1.4449348111684153,1.7322475045833123,1.1607340843948322]);
		
		var size1DComp = result.patterns.map(p => HEURISTICS.SIZE_AND_1D_COMPACTNESS(0)(p, points));
		expect(size1DComp).toEqual([1.1607340843948322,0.6964404506368993,0.5,1.4449348111684153,1.7322475045833123,0.6964404506368993]);
		
		var vecs = result.patterns.map(p => p.vectors)
		var regs = vecs.map(v => HEURISTICS.getVectorsRegularity(v, 0));
		expect(regs).toEqual([0,0,0.5,0,0,0.3333333333333333])
		
		/*var para = vecs.map(v => HEURISTICS.getAxisParallelism(v, 0));
		expect(para).toEqual([0,0,0,1,0,0]);
		
		var anti = vecs.map(v => HEURISTICS.getAxisNonParallelism(v, 0));
		expect(anti).toEqual([1,1,1,0,1,1]);*/
		
		//test bounding box
		//const points = HEURISTICS.getPointsInBoundingBox()
		
	});

	it("can quantize the data", function() {
		var quantizer = new Quantizer([QUANT_FUNCS.TRANSP_SORTED_SUMMARIZE(2), QUANT_FUNCS.ROUND(2), QUANT_FUNCS.ORDER()]);
		var result = quantizer.getQuantizedPoints([[[1,4,2,6,3],2.34264,9],[[1,4,7,6,3],5.65564,2]]);
		expect(JSON.stringify(result)).toBe("[[0,2,2.34,0],[0,1,5.66,1]]");

		var quantizer = new Quantizer([QUANT_FUNCS.CLUSTER(2)]);
		var result2 = JSON.stringify(quantizer.getQuantizedPoints([[[0,2,3]],[[1,1,2]],[[7,9,2]],[[0,3,1]]]));
		expect(result2 === "[[0],[0],[1],[0]]" || result2 === "[[1],[1],[0],[1]]").toBe(true);
	});
	
	it("can do graph theory", () => {
		var result = siatec(points);
		//console.log(graphs.getConnectednessRatings(result))
	});
	
	it("has some utils", () => {
		expect(toOrderedPointString([[10,3],[9,5],[9,4],[9,10]])).toBe('[[9,4],[9,5],[9,10],[10,3]]');
	});

});
