/**
 * OpSemRegistry — Operation Semantic Classifier
 *
 * Loads the op-sem-registry.yaml and provides deterministic classification
 * of tool calls into 6 operation semantic categories:
 *   OP_READ | OP_WRITE | OP_DELETE | OP_EXEC | OP_NETWORK | OP_MEMORY
 *
 * For exec commands, also provides sub-classification into
 *   VCS_READ | VCS_WRITE | VCS_DANGEROUS | PKG | PKG_EXEC | PKG_DANGEROUS
 *   BUILD | FS_READ | FS_WRITE | FS_DELETE | SCRIPT | DATA | ENV_READ
 *
 * This is a PURE DATA component — no rules, no evaluation, no decisions.
 *
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';

// ── Type definitions ──

export type OpSemCode =
  'OP_READ' | 'OP_WRITE' | 'OP_DELETE' | 'OP_EXEC' | 'OP_NETWORK' | 'OP_MEMORY';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface OpSemResult {
  code: OpSemCode;
  subCode?: string;
  risk: RiskLevel;
  label: string;
  /** Value used by the ERDL evaluator (string form) */
  codeStr: string;
  subCodeStr: string;
  riskStr: string;
}

interface CategoryDef {
  risk: RiskLevel;
  label: string;
  description: string;
  default_decision: string;
}

interface ExecSubDef {
  sub_code: string;
  risk: RiskLevel;
  default_actions?: Record<string, string>;
}

interface RegistryData {
  version: string;
  categories: Record<string, CategoryDef>;
  tool_map: Record<string, string>;
  exec_sub_map: Record<string, ExecSubDef>;
  parameter_risk_triggers: Record<string, string[]>;
}

export class OpSemRegistry {
  private data: RegistryData | null = null;

  /** Load registry from YAML file */
  load(yamlPath?: string): void {
    const defaultPath = path.resolve(__dirname, 'op-sem-registry.yaml');
    const filePath = yamlPath ?? defaultPath;

    if (!fs.existsSync(filePath)) {
      throw new Error(`OpSemRegistry: file not found: ${filePath}`);
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    this.data = yaml.load(raw) as RegistryData;

    if (!this.data?.version || !this.data?.categories || !this.data?.tool_map) {
      throw new Error(
        'OpSemRegistry: invalid YAML structure — missing version/categories/tool_map',
      );
    }
  }

  /** Reload without restarting (hot-reload compatible) */
  reload(yamlPath?: string): void {
    this.load(yamlPath);
  }

  /**
   * Classify a tool call into operation semantics.
   *
   * @param toolName  — e.g. "exec", "read_file", "write_file"
   * @param args      — tool arguments (used for exec command sub-classification)
   */
  classify(toolName: string, args: Record<string, unknown>): OpSemResult {
    if (!this.data) {
      return this.unknownResult(toolName);
    }

    const semCode = (this.data.tool_map[toolName] as OpSemCode | undefined) ?? 'OP_EXEC'; // unknown tools → EXEC
    const category = this.data.categories[semCode];
    const result: OpSemResult = {
      code: semCode,
      risk: category?.risk ?? 'medium',
      label: category?.label ?? semCode,
      codeStr: semCode,
      subCodeStr: '',
      riskStr: category?.risk ?? 'medium',
    };

    // For exec — further classify by command name
    if (semCode === 'OP_EXEC' && args['command']) {
      const command = String(args['command']).trim();
      const parts = command.split(/\s+/);
      const exe = parts[0] ?? '';
      const subAction = parts[1] ?? '';

      const subDef = this.data.exec_sub_map[exe];
      if (subDef) {
        result.subCode = subDef.sub_code;
        result.risk = subDef.risk;

        // Check if specific sub-action overrides risk
        if (subAction && subDef.default_actions) {
          const actionCode = subDef.default_actions[subAction];
          if (actionCode) {
            result.subCode = actionCode;
            // Map VCS_DANGEROUS / PKG_DANGEROUS → high risk
            if (actionCode.endsWith('_DANGEROUS')) {
              result.risk = 'high';
            } else if (
              actionCode.endsWith('_WRITE') ||
              actionCode === 'PKG_EXEC' ||
              actionCode === 'SCRIPT'
            ) {
              // Keep medium unless already higher
            } else {
              result.risk = 'low';
            }
          }
        }

        // Check for parameter risk triggers
        const triggers = this.data.parameter_risk_triggers[exe];
        if (triggers) {
          for (const trigger of triggers) {
            if (command.includes(trigger)) {
              result.risk = 'high';
              // Don't override subCode, just escalate risk
              break;
            }
          }
        }
      } else {
        result.subCode = 'UNKNOWN';
      }
    }

    result.subCodeStr = result.subCode ?? '';
    return result;
  }

  /** Get default classification for unknown tools */
  private unknownResult(_toolName: string): OpSemResult {
    void _toolName;
    return {
      code: 'OP_EXEC',
      risk: 'high',
      label: 'unknown operation',
      codeStr: 'OP_EXEC',
      subCodeStr: 'UNKNOWN',
      riskStr: 'high',
    };
  }

  /** Check if the registry is loaded */
  get isLoaded(): boolean {
    return this.data !== null;
  }

  /** Get all defined categories (for frontend display / audit) */
  getCategories(): CategoryDef[] {
    if (!this.data) return [];
    return Object.entries(this.data.categories).map(([, v]) => v);
  }
}
