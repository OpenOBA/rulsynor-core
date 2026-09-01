export * from './types.js'
export {
  RING_K_DISCLAIMER,
  INTENT_DOMAIN_MAP,
  resolveDomain,
  validateKnowledge,
  chunkKnowledge,
  formatRagContext,
  checkModeGates,
  filterToolsByOccupation,
  formatEntityProfile,
  collectToolAnchors,
  buildGovernedByIndex,
  dataRef,
  resolveBudget,
} from './utils.js'
export type {
  KnowledgeValidatorInput,
  KnowledgeValidationResult,
  ModeGateStatus,
  ToolAnchorInput,
  ToolAnchor,
} from './utils.js'
