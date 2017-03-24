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
	var vectors = [[1,1],[1,3],[2,1],[2,2],[2,3],[3,2],[4,3],[5,4]];

	/*beforeEach(function(done) {

		/*GlobalVars.DYMO_STORE = new DymoStore(function(){
			//example from figure 12 in meredith-lemström-wiggins 2003
			//dimensions reversed due to order reversing in easystore
			//points (3,4), (4,5) added to test iterative cosiatec


			GlobalVars.DYMO_STORE.addDymo("dymo1");
			GlobalVars.DYMO_STORE.addDymo("a", "dymo1");
			GlobalVars.DYMO_STORE.addDymo("b", "dymo1");
			GlobalVars.DYMO_STORE.addDymo("c", "dymo1");
			GlobalVars.DYMO_STORE.addDymo("d", "dymo1");
			GlobalVars.DYMO_STORE.addDymo("e", "dymo1");
			GlobalVars.DYMO_STORE.addDymo("f", "dymo1");
			GlobalVars.DYMO_STORE.addDymo("g", "dymo1");
			GlobalVars.DYMO_STORE.addDymo("h", "dymo1");
			GlobalVars.DYMO_STORE.setFeature("a", ONSET_FEATURE, 1);
			GlobalVars.DYMO_STORE.setFeature("a", PITCH_FEATURE, 1);
			GlobalVars.DYMO_STORE.setFeature("b", ONSET_FEATURE, 3);
			GlobalVars.DYMO_STORE.setFeature("b", PITCH_FEATURE, 1);
			GlobalVars.DYMO_STORE.setFeature("c", ONSET_FEATURE, 1);
			GlobalVars.DYMO_STORE.setFeature("c", PITCH_FEATURE, 2);
			GlobalVars.DYMO_STORE.setFeature("d", ONSET_FEATURE, 2);
			GlobalVars.DYMO_STORE.setFeature("d", PITCH_FEATURE, 2);
			GlobalVars.DYMO_STORE.setFeature("e", ONSET_FEATURE, 3);
			GlobalVars.DYMO_STORE.setFeature("e", PITCH_FEATURE, 2);
			GlobalVars.DYMO_STORE.setFeature("f", ONSET_FEATURE, 2);
			GlobalVars.DYMO_STORE.setFeature("f", PITCH_FEATURE, 3);
			GlobalVars.DYMO_STORE.setFeature("g", ONSET_FEATURE, 3);
			GlobalVars.DYMO_STORE.setFeature("g", PITCH_FEATURE, 4);
			GlobalVars.DYMO_STORE.setFeature("h", ONSET_FEATURE, 4);
			GlobalVars.DYMO_STORE.setFeature("h", PITCH_FEATURE, 5);
			var surface = DymoStructureInducer.getAllParts(["dymo1"], GlobalVars.DYMO_STORE);
		  vectors = DymoStructureInducer.toVectors(surface, GlobalVars.DYMO_STORE);
			done();
		});
	});*/

	it ("can build a hierarchy from patterns", function() {
		var inducer = new StructureInducer(vectors);
		var structure = inducer.getStructure(0);
		expect(JSON.stringify(structure)).toEqual("[0,[1,2,3,4],[5,6],7]");
	});

	it("can find repeating geometric patterns", function() {
		var siatec = new Siatec(vectors);
		var patterns = siatec.getPatterns();
		console.log(patterns)

		expect(patterns.length).toBe(17);
		expect(patterns[5].length).toBe(4);

		var occurrences = siatec.getOccurrences();
		expect(occurrences.length).toBe(17);
		expect(occurrences[2].length).toBe(3);
		//console.log(JSON.stringify(occurrences))

		var minimized = siatec.minimizePattern(patterns[5], vectors);
		console.log(JSON.stringify(minimized));
		expect(patterns[5].length).toBe(4);
		expect(minimized.length).toBe(3);
		expect(HEURISTICS.COMPACTNESS2(patterns[5], null, null, vectors)).toBe(0.25);
		expect(HEURISTICS.COMPACTNESS2(minimized, null, null, vectors)).toBe(0.5);

		var divided = siatec.dividePattern(patterns[5], vectors);
		console.log(JSON.stringify(divided));
		expect(divided.length).toBe(2);
		expect(divided[0].length).toBe(2);
		expect(divided[1].length).toBe(2);
	});

	it("can select the best patterns", function() {
		//non-overlapping patterns
		var cosiatec = new Cosiatec(vectors);
		var patterns = cosiatec.getPatterns();
		expect(JSON.stringify(patterns)).toEqual("[[[1,1],[2,2]],[[1,3]]]");

		//overlapping patterns
		cosiatec = new Cosiatec(vectors, {overlapping: true});
		patterns = cosiatec.getPatterns();
		expect(JSON.stringify(patterns)).toEqual("[[[1,1],[2,2]],[[2,1],[2,2]],[[1,1],[1,3],[2,2]]]");
	});

	it("has various different heuristics", function() {
		var siatec = new Siatec(vectors);
		var patterns = siatec.getPatterns();
		var occurrences = siatec.getOccurrences();

		var coverage = patterns.map((p,i) => HEURISTICS.COVERAGE(p, null, occurrences[i], vectors));
		expect(coverage).toEqual([ 0.375, 0.75, 0.75, 1, 0.75, 0.75, 1, 1, 1, 0.75, 0.75, 1, 1, 0.75, 1, 1, 1 ]);

		var compactness = patterns.map(p => HEURISTICS.COMPACTNESS(p, null, null, vectors));
		expect(compactness).toEqual([ 0.25, 0.2, 0.2, 0.125, 0.2, 0.14285714285714285, 0.125, 0.125, 0.125, 0.3333333333333333, 0.3333333333333333, 0.125, 0.125, 0.3333333333333333, 0.125, 0.125, 0.125 ]);

		var compactness2 = patterns.map(p => HEURISTICS.COMPACTNESS2(p, null, null, vectors));
		expect(compactness2).toEqual([ 0.3333333333333333, 0.25, 0.25, 0.125, 0.3333333333333333, 0.25, 0.125, 0.125, 0.125, 0.5, 0.5, 0.125, 0.125, 0.5, 0.125, 0.125, 0.125 ]);
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
