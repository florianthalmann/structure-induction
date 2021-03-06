export { StructureResult, CacheableStructureOptions, getStructure, getCosiatec,
  getCosiatecIndexOccurrences, getSmithWaterman, getDualSmithWaterman,
  getMultiCosiatec, Pattern, MultiStructureResult, MultiOpsiatecResult } from './structure';
export { IterativeSmithWatermanResult, SmithWatermanOptions,
  getSimpleSmithWatermanPath } from './sw-structure';
export { inferHierarchyFromMatrix, inferHierarchyFromTypeSequence } from './hierarchies';
export { getSelfSimilarityMatrix, getAffinityAlignment,
  AffinityAlignmentOptions, AffinityAlignmentResult } from './similarity';
export { Quantizer, ArrayMap, QUANT_FUNCS } from './quantizer';
export { SmithWaterman } from './smith-waterman';
export { CosiatecHeuristic, HEURISTICS } from './heuristics';
export { OPTIMIZATION } from './optimizer';
export { getCosiatecOptionsString, OpsiatecResult, OpsiatecOptions } from './opsiatec';
export { getConnectednessRatings } from './graphs';
export { pointsToIndices } from './util';