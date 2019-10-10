export { StructureResult, CacheableStructureOptions, getStructure, getCosiatec,
  getCosiatecIndexOccurrences, getSmithWaterman, getDualSmithWaterman, Pattern } from './structure';
export { IterativeSmithWatermanResult, SmithWatermanOptions } from './sw-structure';
export { Hierarchizer, Segmentation } from './hierarchizer';
export { Similarity } from './similarity';
export { Quantizer, ArrayMap, QUANT_FUNCS } from './quantizer';
export { SmithWaterman } from './smith-waterman';
export { CosiatecHeuristic, HEURISTICS } from './heuristics';
export { OPTIMIZATION } from './optimizer';
export { getCosiatecOptionsString, OpsiatecResult, OpsiatecOptions } from './opsiatec';
export { getConnectednessRatings } from './graphs';
export { pointsToIndices } from './util';