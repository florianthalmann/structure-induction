var _ = require('lodash');
var StructureInducer = require('../lib/structure').StructureInducer;
var siatec = require('../lib/siatec').siatec;
var cosiatec = require('../lib/cosiatec').cosiatec;
var optimizer = require('../lib/optimizer');
var Quantizer = require('../lib/quantizer').Quantizer;
var QUANT_FUNCS = require('../lib/quantizer').QUANT_FUNCS;
var HEURISTICS = require('../lib/heuristics').HEURISTICS;

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

		expect(result.patterns.length).toBe(17);
		expect(result.patterns[5].points.length).toBe(4);

		var occurrences = result.patterns.map(p => p.occurrences);
		expect(occurrences.length).toBe(17);
		expect(occurrences[2].length).toBe(3);
		//console.log(JSON.stringify(occurrences))

		var original = result.patterns[5];
		var minimized = optimizer.minimize(result, HEURISTICS.COMPACTNESS, 0);
		minimized = minimized.patterns[5];
		//console.log(JSON.stringify(minimized));
		expect(original.points.length).toBe(4);
		expect(minimized.points.length).toBe(2);
		expect(HEURISTICS.COMPACTNESS(original.points, null, null, points)).toBe(0.5714285714285714);
		expect(HEURISTICS.COMPACTNESS(minimized.points, null, null, points)).toBe(1);

		var divided = optimizer
			.dividePattern(original, points, 0, HEURISTICS.COMPACTNESS)
			.map(p => p.points);
		expect(JSON.stringify(divided)).toBe('[[[1,1]],[[2,1]],[[3,2],[4,3]]]');
		
		var partitioned = optimizer
			.partitionPattern(original, points, 0, HEURISTICS.COMPACTNESS)
			.map(p => p.points);
		//all individual partitions due to vectors [[0,0],[1,1]]
		expect(JSON.stringify(partitioned)).toBe('[[[1,1]],[[2,1]],[[3,2]],[[4,3]]]');
		
		original.vectors = [[0,0],[2,0]];
		partitioned = optimizer
			.partitionPattern(original, points, 0, HEURISTICS.COMPACTNESS)
			.map(p => p.points);
		//partition down the middle the best
		expect(JSON.stringify(partitioned)).toBe('[[[1,1],[2,1]],[[3,2],[4,3]]]');
		
		original.vectors = [[0,0],[3,0]];
		partitioned = optimizer
			.partitionPattern(original, points, 0, HEURISTICS.COMPACTNESS)
			.map(p => p.points);
		//partition down the middle still heuristically the best
		expect(JSON.stringify(partitioned)).toBe('[[[1,1],[2,1]],[[3,2],[4,3]]]');
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
	});

	it("has various different heuristics", function() {
		var result = siatec(points);

		var coverage = result.patterns.map(p => HEURISTICS.COVERAGE(p.points, null, p.occurrences, points));
		expect(coverage).toEqual([ 0.375, 0.75, 0.75, 1, 0.75, 0.75, 1, 1, 1, 0.75, 0.75, 1, 1, 0.75, 1, 1, 1 ]);

		var compactness = result.patterns.map(p => HEURISTICS.COMPACTNESS(p.points, null, null, points));
		expect(compactness).toEqual([ 1, 1, 1, 1, 0.6, 0.5714285714285714, 1, 1, 1, 0.6666666666666666, 0.6666666666666666, 1, 1, 0.6666666666666666, 1, 1, 1 ]);
		
		var sizeComp = result.patterns.map(p => HEURISTICS.SIZE_AND_COMPACTNESS(p.points, null, null, points));
		expect(sizeComp).toEqual([ 1.7411011265922482, 1.7411011265922482, 1.7411011265922482, 1, 1.4449348111684153, 1.7322475045833123, 1, 1, 1, 1.1607340843948322, 1.1607340843948322, 1, 1, 1.1607340843948322, 1, 1, 1 ]);
		
		var size1DComp = result.patterns.map(p => HEURISTICS.SIZE_AND_1D_COMPACTNESS(0)(p.points, null, null, points));
		expect(size1DComp).toEqual([ 1.1607340843948322, 0.6964404506368993, 0.6964404506368993, 0.5, 1.4449348111684153, 1.7322475045833123, 0.5, 0.5, 0.3333333333333333, 0.6964404506368993, 0.8705505632961241, 0.5, 0.3333333333333333, 0.6964404506368993, 0.3333333333333333, 0.5, 0.5 ]);
		
		//test bounding box
		//const points = HEURISTICS.getPointsInBoundingBox()
		
	});

	it("can quantize the data", function() {
		var quantizer = new Quantizer([QUANT_FUNCS.TRANSP_SORTED_SUMMARIZE(2), QUANT_FUNCS.ROUND(2), QUANT_FUNCS.ORDER()]);
		var result = quantizer.getQuantizedPoints([[[1,4,2,6,3],2.34264,9],[[1,4,7,6,3],5.65564,2]]);
		expect(JSON.stringify(result)).toBe("[[0,2,2.34,0],[0,1,5.66,1]]");

		var quantizer = new Quantizer([QUANT_FUNCS.CLUSTER(2)]);
		result = JSON.stringify(quantizer.getQuantizedPoints([[[0,2,3]],[[1,1,2]],[[7,9,2]],[[0,3,1]]]));
		expect(result === "[[0],[0],[1],[0]]" || result === "[[1],[1],[0],[1]]").toBe(true);
	});

});
