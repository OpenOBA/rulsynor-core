// ToolEnhancement type definitions (shared with the rulsynor backend tool registry).

// Enhancement subtypes
export interface ToolUsageContext {
  when?: string;
  priority?: string;
  whenToUse?: string;
}
export interface ToolPreconditions {
  checks?: string[];
  inputHints?: string;
}
export interface ToolInputExample {
  description: string;
  input: Record<string, unknown>;
}
export interface ToolErrorHandling {
  onError?: string;
  fallback?: string;
  commonErrors?: string;
}
export interface ToolSideEffects {
  modifies?: string[];
  reversible?: boolean;
  modifiesData?: boolean;
}
export interface ToolRelatedTools {
  before?: string[];
  after?: string[];
  insteadOf?: string[];
}
export interface ToolBusinessPreconditions {
  timeConstraints?: string[];
  rateLimits?: string[];
}
export interface ToolLifecycle {
  create?: string;
  update?: string;
  deprecate?: string;
}
export interface ToolBusinessRules {
  when?: string;
  then?: string;
  summary?: string;
  relatedRules?: string[];
  relatedKnowledge?: string[];
}

// Top-level enhancement
export interface ToolEnhancement {
  description?: string;
  usage?: string;
  usageContext?: ToolUsageContext;
  preconditions?: ToolPreconditions;
  inputExamples?: ToolInputExample[];
  errorHandling?: ToolErrorHandling;
  sideEffects?: ToolSideEffects;
  relatedTools?: ToolRelatedTools;
  businessPreconditions?: ToolBusinessPreconditions;
  lifecycle?: ToolLifecycle;
  businessRules?: ToolBusinessRules;
}
