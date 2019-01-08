var _ = require('lodash');
var StructureInducer = require('../lib/structure').StructureInducer;
var Siatec = require('../lib/siatec').Siatec;
var Cosiatec = require('../lib/cosiatec').Cosiatec;
var Quantizer = require('../lib/quantizer').Quantizer;
var QUANT_FUNCS = require('../lib/quantizer').QUANT_FUNCS;
var HEURISTICS = require('../lib/heuristics').HEURISTICS;

describe("a structure induction algorithm", function() {

	//example from figure 12 in meredith-lemström-wiggins 2003
	//dimensions reversed due to order reversing in easystore
	//points (3,4), (4,5) added to test iterative cosiatec
	var points = [[1,1],[1,3],[2,1],[2,2],[2,3],[3,2],[4,3],[5,4]];

	/*it ("can build a hierarchy from patterns", function() {
		var inducer = new StructureInducer(points);
		var structure = inducer.getStructure(0);
		expect(JSON.stringify(structure)).toEqual("[0,[1,2,3,4],[5,6],7]");
	});*/

	it("can find repeating geometric patterns", function() {
		var siatec = new Siatec(points);
		var patterns = siatec.getPatterns();

		expect(patterns.length).toBe(17);
		expect(patterns[5].length).toBe(4);

		var occurrences = siatec.getOccurrences();
		expect(occurrences.length).toBe(17);
		expect(occurrences[2].length).toBe(3);
		//console.log(JSON.stringify(occurrences))

		var minimized = siatec.minimizePattern(patterns[5], points);
		//console.log(JSON.stringify(minimized));
		expect(patterns[5].length).toBe(4);
		expect(minimized.length).toBe(2);
		expect(HEURISTICS.COMPACTNESS(patterns[5], null, null, points)).toBe(0.5714285714285714);
		expect(HEURISTICS.COMPACTNESS(minimized, null, null, points)).toBe(1);

		var divided = siatec.dividePattern(patterns[5], points);
		//console.log(JSON.stringify(divided));
		expect(divided.length).toBe(2);
		expect(divided[0].length).toBe(2);
		expect(divided[1].length).toBe(2);
		
		var partitioned = siatec.partitionPattern(patterns[5], points, 0, [[0,0],[2,0]]);
		expect(JSON.stringify(partitioned)).toBe('[[[1,1],[2,1]],[[3,2],[4,3]]]');
		partitioned = siatec.partitionPattern(patterns[5], points, 0, siatec.getOccurrenceVectors()[5]);
		expect(JSON.stringify(partitioned)).toBe('[[[1,1]],[[2,1]],[[3,2]],[[4,3]]]');
		partitioned = siatec.partitionPattern(patterns[5], points, 0, [[0,0],[3,0]]);
		expect(JSON.stringify(partitioned)).toBe('[[[1,1],[2,1]],[[3,2],[4,3]]]');
	});

	it("can select the best patterns", function() {
		//non-overlapping patterns
		var cosiatec = new Cosiatec(points);
		var patterns = cosiatec.getPatterns();
		expect(JSON.stringify(patterns)).toEqual("[[[1,1],[2,2]],[[1,3]]]");

		//overlapping patterns
		cosiatec = new Cosiatec(points, {overlapping: true});
		patterns = cosiatec.getPatterns();
		expect(JSON.stringify(patterns)).toEqual("[[[1,1],[2,2]],[[1,1],[1,3],[2,2]]]");
	});

	it("has various different heuristics", function() {
		var siatec = new Siatec(points);
		var patterns = siatec.getPatterns();
		var occurrences = siatec.getOccurrences();

		var coverage = patterns.map((p,i) => HEURISTICS.COVERAGE(p, null, occurrences[i], points));
		expect(coverage).toEqual([ 0.375, 0.75, 0.75, 1, 0.75, 0.75, 1, 1, 1, 0.75, 0.75, 1, 1, 0.75, 1, 1, 1 ]);

		var compactness = patterns.map(p => HEURISTICS.COMPACTNESS(p, null, null, points));
		expect(compactness).toEqual([ 0.5, 0.4, 0.4, 0.125, 0.6, 0.5714285714285714, 0.125, 0.125, 0.125, 0.6666666666666666, 0.6666666666666666, 0.125, 0.125, 0.6666666666666666, 0.125, 0.125, 0.125 ]);
		
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
