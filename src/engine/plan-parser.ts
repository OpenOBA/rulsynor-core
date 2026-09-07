/**
 * PlanParser — Parse LLM natural-language execution plans into structured form
 *
 * Extracts structured plan steps from LLM PLAN text for ERDL evaluation.
 * Handles variable formatting (LLMs are not strict syntax generators).
 *
 */

export interface ParsedPlanStep {
  index: number;
  description: string;
  tools: string[];
  opSem: string;
  purpose: string;
}

export interface ParsedPlan {
  /** Raw plan text from LLM */
  planText: string;
  /** Whether a plan was successfully extracted */
  hasPlan: boolean;
  /** Parsed steps */
  steps: ParsedPlanStep[];
  /** Extracted metadata */
  goal: string;
  successCriteria: string;
  estimatedRounds: number;
  riskLevel: 'low' | 'medium' | 'high';
  alternatives: string;
}

export class PlanParser {
  /**
   * Parse plan text from an LLM message.
   *
   * Expected format (flexible — handles common LLM variations):
   *
   * PLAN:
   * Step 1: description | tools: tool1, tool2 | op: READ | purpose: xxx
   * Step 2: description | tools: tool3 | op: EXEC | purpose: xxx
   *
   * Supports both English and Chinese markers.
   */
  parse(text: string): ParsedPlan {
    const planText = this.extractPlanSection(text);
    const hasPlan = planText.length > 0;

    const steps = hasPlan ? this.parseSteps(planText) : [];

    return {
      planText,
      hasPlan,
      steps,
      goal: this.extractField(text, /(?:目标|Goal|任务目标)[：:]\s*(.+)/i) ?? 'not specified',
      successCriteria:
        this.extractField(text, /(?:成功标准|Success|预期结果)[：:]\s*(.+)/i) ?? 'not specified',
      estimatedRounds: this.extractNumber(text, /(?:预计轮次|Rounds|预估)[：:]\s*(\d+)/i) ?? 4,
      riskLevel: this.extractRiskLevel(text),
      alternatives:
        this.extractField(text, /(?:替代方案|Alternatives?)[：:]\s*(.+)/i) ?? 'not specified',
    };
  }

  /** Quick check: does this text contain a recognizable plan? */
  hasRecognizablePlan(text: string): boolean {
    // Widen recognition: not only PLAN/计划 keywords, but also common structured-list forms LLMs emit.
    // Root-cause review: the original regex only matched "PLAN|计划|执行计划|执行方案" + colon/newline,
    // but LLMs often directly emit "Step 1: ..." "1. ..." "- ...", making plan detection intermittent.
    if (/(?:PLAN|计划|执行计划|执行方案)[：:\n]/.test(text)) return true;
    // Structured step list: Step N / 步骤 N / numeric numbering (≥2 steps)
    const stepPattern = /(?:Step|步骤)\s*\d|^\s*\d+[.)、]\s+/gm;
    const numericSteps = text.match(stepPattern) ?? [];
    return numericSteps.length >= 2;
  }

  // ── Private ──

  /** Extract the plan section from text (lines between PLAN: and next section) */
  private extractPlanSection(text: string): string {
    const match = text.match(
      /(?:PLAN|计划|执行计划|执行方案)[：:\s]*\n([\s\S]*?)(?:\n\s*(?:成功标准|预计|风险|替代|Success|Rounds|Risk|Alternative)|\n\s*$|$)/,
    );
    return match?.[1]?.trim() ?? '';
  }

  /** Parse individual steps from plan section */
  private parseSteps(section: string): ParsedPlanStep[] {
    const steps: ParsedPlanStep[] = [];

    // Split by step numbers: "步骤1", "Step 1", "1.", or just lines starting with tools
    const lines = section.split('\n').filter(l => l.trim().length > 0);

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip metadata lines — these are plan-level fields, not steps
      if (/^(?:目标|Goal|成功标准|Success|预计|Rounds|风险|Risk|替代|Alternative)/i.test(trimmed))
        continue;

      // Match: 步骤1: / Step 1: / 1.
      const idxMatch = trimmed.match(/(?:步骤|Step)\s*(\d+)[：:.]\s*|^(\d+)[.)]\s+/i);
      const index = idxMatch ? parseInt(idxMatch[1] ?? idxMatch[2] ?? '0', 10) : steps.length + 1;

      // Extract fields using the pipe-delimited format.
      // The operation label accepts `op:` / `Operation:` / `OpSem:` / `操作:` —
      // `\bop\b` uses word boundaries so `op` inside `loop`/`stop`/`develop` is not a false match.
      const desc = this.extractStepField(
        trimmed,
        /描述[：:]?\s*|^(?:步骤\d+[：:.]\s*)?/i,
        /\s*\|\s*(?:工具|Tools?)/i,
      );
      const tools = this.extractStepField(
        trimmed,
        /(?:工具|Tools?)[：:=]\s*/i,
        /\s*\|\s*(?:\bop\b|Operation|OpSem|操作)/i,
      );
      const opSem = this.extractStepField(
        trimmed,
        /(?:\bop\b|Operation|OpSem|操作)[：:=\s]*/i,
        /\s*\|\s*(?:目的|Purpose|Reason)/i,
      );
      const purpose = this.extractStepField(trimmed, /(?:目的|Purpose|Reason)[：:=\s]*/i, /$/i);

      if (!desc && !tools) continue; // skip empty lines

      steps.push({
        index,
        description: desc?.trim() ?? trimmed.slice(0, 80),
        tools: this.parseToolsList(tools?.trim() ?? ''),
        opSem: this.normalizeOpSem(opSem?.trim() ?? ''),
        purpose: purpose?.trim() ?? 'not specified',
      });
    }

    return steps;
  }

  /** Parse tools list from "tool1, tool2" or "tool1+tool2" format */
  private parseToolsList(raw: string): string[] {
    if (!raw) return [];
    return raw
      .split(/[,+，、]/)
      .map(t => t.trim())
      .filter(t => t.length > 0);
  }

  /** Normalize operation semantic labels to OP_* codes */
  private normalizeOpSem(raw: string): string {
    if (!raw || raw.trim().length === 0) return 'OP_UNKNOWN';
    const lower = raw.toLowerCase().trim();
    if (lower.includes('读') || lower.includes('read')) return 'OP_READ';
    if (lower.includes('写') || lower.includes('修改') || lower.includes('write'))
      return 'OP_WRITE';
    if (
      lower.includes('删') ||
      lower.includes('移除') ||
      lower.includes('delete') ||
      lower.includes('remove')
    )
      return 'OP_DELETE';
    if (lower.includes('执行') || lower.includes('运行') || lower.includes('exec'))
      return 'OP_EXEC';
    if (
      lower.includes('网络') ||
      lower.includes('搜索') ||
      lower.includes('network') ||
      lower.includes('fetch')
    )
      return 'OP_NETWORK';
    if (lower.includes('记忆') || lower.includes('memory')) return 'OP_MEMORY';
    return `OP_${raw.toUpperCase().replace(/\s+/g, '_')}`;
  }

  /** Extract a named field value from text */
  private extractField(text: string, pattern: RegExp): string | null {
    const match = text.match(pattern);
    return match?.[1]?.trim() ?? null;
  }

  /** Extract a numeric field value */
  private extractNumber(text: string, pattern: RegExp): number | null {
    const match = text.match(pattern);
    return match?.[1] ? parseInt(match[1], 10) : null;
  }

  /** Extract risk level from text */
  private extractRiskLevel(text: string): 'low' | 'medium' | 'high' {
    const field = this.extractField(text, /(?:风险|Risk)[：:]\s*(.+)/i);
    if (!field) return 'medium';
    const lower = field.toLowerCase();
    if (/(?:低|low|safe|安全)/.test(lower)) return 'low';
    if (/(?:高|high|danger|危险)/.test(lower)) return 'high';
    return 'medium';
  }

  /** Extract step field value between two delimiters */
  private extractStepField(line: string, startPattern: RegExp, endPattern: RegExp): string | null {
    const startIdx = line.search(startPattern);
    if (startIdx === -1) return null;

    const afterStart = line.slice(startIdx).replace(startPattern, '');
    const endIdx = afterStart.search(endPattern);
    if (endIdx !== -1) {
      return afterStart.slice(0, endIdx).trim();
    }
    return afterStart.trim();
  }
}
