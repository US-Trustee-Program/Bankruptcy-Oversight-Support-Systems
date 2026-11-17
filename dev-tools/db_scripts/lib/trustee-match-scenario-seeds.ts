/**
 * Seed documents built from the trustee-match fixture scenarios
 * (common/src/cams/test-utilities/trustee-match-findings.scenarios.ts), whose findings are the
 * real pipeline's output (trustee-match-findings.generated.json). Seeds never hand-write scores.
 */

import MockData from '@common/cams/test-utilities/mock-data.js';
import {
  TRUSTEE_MATCH_FINDINGS_SCENARIOS,
  type TrusteeMatchScenarioKey,
} from '@common/cams/test-utilities/trustee-match-findings.scenarios.js';
import type { TrusteeMatchSource } from '@common/cams/trustee-match-verification.js';
import { buildVariant, computeFingerprint } from './compute-fingerprint.js';
import { generateSearchTokens } from './phonetic-tokens.js';

/** The identity-task fields a sync (DXTR unless stated) derives from one unresolved pipeline run. */
export function identityTaskFields(
  key: TrusteeMatchScenarioKey,
  source: TrusteeMatchSource = 'DXTR',
) {
  const findings = MockData.getTrusteeMatchScenarioFindings(key);
  const variant = buildVariant(findings.sourceRaw);
  return {
    documentType: 'TRUSTEE_MATCH_VERIFICATION',
    taskType: 'trustee-match',
    source,
    fingerprint: computeFingerprint(variant),
    variant,
    sourceTrustee: findings.sourceRaw,
    mismatchReason: findings.candidates.length > 1 ? 'ambiguous' : 'no match',
    findings,
  };
}

/** The scenarios' CAMS trustees as trustees-collection documents, each trustee once. */
export function scenarioTrusteeDocuments(...keys: TrusteeMatchScenarioKey[]) {
  const documents = new Map(
    keys
      .flatMap((key) => TRUSTEE_MATCH_FINDINGS_SCENARIOS[key].trustees)
      .map((trustee) => [
        trustee.trusteeId,
        {
          ...trustee,
          documentType: 'TRUSTEE',
          phoneticTokens: generateSearchTokens(trustee.name),
        },
      ]),
  );
  return [...documents.values()];
}

const SEEDER = { id: 'SEED', name: 'Test Data Seeder' };

/**
 * The surrogate CASE_APPOINTMENT the sync writes for a case it raised an identity task for. Its
 * trusteeId is the task's fingerprint, which is how the task finds its affected cases.
 */
export function buildSurrogate(opts: {
  slug: string;
  caseId: string;
  fingerprint: string;
  chapter: string;
  courtId: string;
  courtDivisionCode: string;
  appointedDate: string;
}) {
  return {
    id: `seed-surrogate-${opts.slug}-${opts.caseId}`,
    documentType: 'CASE_APPOINTMENT',
    caseId: opts.caseId,
    trusteeId: opts.fingerprint,
    assignedOn: `${opts.appointedDate}T00:00:00.000Z`,
    appointedDate: opts.appointedDate,
    isSurrogate: true,
    chapter: opts.chapter,
    courtId: opts.courtId,
    courtDivisionCode: opts.courtDivisionCode,
    createdOn: '2025-03-01T00:00:00.000Z',
    createdBy: SEEDER,
    updatedOn: '2025-03-01T00:00:00.000Z',
    updatedBy: SEEDER,
  };
}
