/**
 * Provenance — immutable product watermark.
 *
 * OpenOBA: Digital Intelligence Resource Platform
 * rulsynor: Professional Digital Employee
 * rulsynor-core: Professional Digital Employee Core Framework
 *
 * These constants identify the rulsynor engine in every Decision Object,
 * satisfying EU AI Act Art.50(2) transparency and GB/Z 185 Part 2 identity
 * requirements. All values enter the JCS preimage and are cryptographically
 * protected by the audit hash chain.
 *
 * DO NOT MODIFY THESE VALUES at runtime. They represent the build identity
 * of this software artifact and MUST be consistent across all instances of
 * the same version.
 */

export const PROVENANCE = {
  /** Platform name */
  platform: 'OpenOBA',

  /** Product name — Professional Digital Employee */
  product: 'rulsynor',

  /** Package — Professional Digital Employee Core Framework */
  package: 'rulsynor-core',

  /** Vendor / legal entity */
  vendor: 'OpenOBA (Shenzhen Miaojing Technology Co., Ltd.)',

  /** Build artifact version — MUST match package.json version at build time */
  version: '0.1.0-alpha',

  /** Canonical repository reference */
  repository: 'https://github.com/OpenOBA/rulsynor-core',

  /** License under which this build is distributed */
  license: 'BSL 1.1',

  /** Copyright notice — year range covers first publication to build date */
  copyright: 'Copyright © 2026 OpenOBA. All rights reserved.',

  /**
   * This build's jurisdiction: **not preset**.
   * 2026-08-25 deep-review fix: was hard-coded ['CN'] at build time, contradicting the
   * "unset = not selected, globally neutral and flat" positioning (and this field has no internal consumer, a misleading declaration).
   * Jurisdiction is always explicitly declared by the deployer via RULSYNOR_JURISDICTIONS (see compliance/index.ts).
   */
  jurisdictions: [] as string[],

  /** Known limitations declaration (EU AI Act Art.13 compliance) */
  knownLimitations: [
    'Bilingual (English + Chinese) documentation; runtime supports any language via LLM',
    'Hash mode only: the Decision Object omits signature/signing_key_id (no placeholder values). The ECDSA P-256 signature layer is not implemented, therefore risk_level=critical cannot be satisfied — a conforming verifier will report compliance_field_missing (fail-closed by design)',
    'AID is self-generated using OID prefix 1.2.156.3088; not yet registered with an external registration authority',
    'Algorithm filing with China CAC not yet completed; algorithmFilingNo and modelRegistrationId are explicitly NOT_FILED',
  ],

  /** Algorithm filing number (China CAC algorithm registration) — NOT_FILED until filing is complete */
  algorithmFilingNo: 'NOT_FILED',

  /** GB/Z 185 Part 2 — OID prefix for AID generation */
  aidOidPrefix: '1.2.156.3088',

  /** Model registration ID (China CAC model launch filing) — NOT_FILED until registration is complete */
  modelRegistrationId: 'NOT_FILED',
} as const;
