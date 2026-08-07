/**
 * Provenance — immutable product watermark.
 *
 * OpenOBA: 数字智力资源平台 (Digital Intelligence Resource Platform)
 * rulsynor: 职业化数字员工 (Professional Digital Employee)
 * rulsynor-core: 职业化数字员工核心框架 (Professional Digital Employee Core Framework)
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

  /** Product name — 职业化数字员工 */
  product: 'rulsynor',

  /** Package — 职业化数字员工核心框架 */
  package: 'rulsynor-core',

  /** Vendor / legal entity */
  vendor: 'OpenOBA (Shenzhen Miaojing Technology Co., Ltd.)',

  /** Build artifact version — MUST match package.json version at build time */
  version: '1.0.0',

  /** Canonical repository reference */
  repository: 'https://github.com/OpenOBA/rulsynor-core',

  /** License under which this build is distributed */
  license: 'MIT',

  /** Copyright notice — year range covers first publication to build date */
  copyright: 'Copyright © 2026 OpenOBA. All rights reserved.',

  /** Jurisdictions of record for this build (hardcoded at build time) */
  jurisdictions: ['CN'] as string[],

  /** Known limitations declaration (EU AI Act Art.13 compliance) */
  knownLimitations: [
    'Bilingual (English + Chinese) documentation; runtime supports any language via LLM',
    'Decision Object signature is a placeholder until ECDSA key infrastructure is deployed (Phase 2)',
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
