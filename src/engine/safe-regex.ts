/**
 * SafeRegExp — ReDoS-protected regex construction.
 *
 * All pattern-based rule conditions (match, matches operators) MUST use
 * safeRegExp() instead of bare `new RegExp()`. This prevents:
 *   1. ReDoS (exponential backtracking) via nested quantifier detection
 *   2. Pattern length overflow via max-length cap
 *   3. Invalid regex crash via try-catch wrapper
 */

const REGEX_MAX_LENGTH = 200;
// Detect nested quantifiers: (a+)+, (a+)*, (a+)+?, (a*)*, (a+){1,10}, etc.
// Matches: ) followed by optional whitespace then another quantifier
const NESTED_QUANTIFIER = /\)\s*([+*?]|\{[^}]+\})/;

export class SafeRegExpError extends Error {
  constructor(message: string) {
    super(`SafeRegExp: ${message}`);
    this.name = 'SafeRegExpError';
  }
}

export function safeRegExp(pattern: string, flags?: string): RegExp {
  if (typeof pattern !== 'string') {
    throw new SafeRegExpError(`pattern must be a string, got ${typeof pattern}`);
  }

  if (pattern.length > REGEX_MAX_LENGTH) {
    throw new SafeRegExpError(
      `pattern exceeds ${REGEX_MAX_LENGTH} chars (got ${pattern.length})`
    );
  }

  if (NESTED_QUANTIFIER.test(pattern)) {
    throw new SafeRegExpError(
      `potential ReDoS pattern rejected: nested quantifiers detected`
    );
  }

  try {
    return new RegExp(pattern, flags);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new SafeRegExpError(`invalid pattern "${pattern}": ${msg}`);
  }
}
