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
import { computeFingerprint } from './compute-fingerprint.js';
import { generateSearchTokens } from './phonetic-tokens.js';

/** The identity-task fields the DXTR sync derives from one unresolved pipeline run. */
export function identityTaskFields(key: TrusteeMatchScenarioKey) {
  const findings = MockData.getTrusteeMatchScenarioFindings(key);
  return {
    documentType: 'TRUSTEE_MATCH_VERIFICATION',
    taskType: 'trustee-match',
    source: 'DXTR',
    fingerprint: computeFingerprint(findings.sourceRaw),
    dxtrTrustee: findings.sourceRaw,
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
