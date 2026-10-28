import { describe, test, expect } from 'vitest';
import { identityTaskFields, scenarioTrusteeDocuments } from './trustee-match-scenario-seeds.js';
import { computeFingerprint } from './compute-fingerprint.js';
import { generateSearchTokens } from './phonetic-tokens.js';
import { validators } from './test-data-utils.js';

describe('identityTaskFields', () => {
  test('a scenario with 2+ candidates is an ambiguous DXTR task over its generated findings', () => {
    const task = identityTaskFields('multipleCandidates');

    expect(task).toMatchObject({
      documentType: 'TRUSTEE_MATCH_VERIFICATION',
      taskType: 'trustee-match',
      source: 'DXTR',
      mismatchReason: 'ambiguous',
    });
    expect(task.findings.candidates).toHaveLength(2);
    expect(task.dxtrTrustee).toEqual(task.findings.sourceRaw);
    expect(task.fingerprint).toBe(computeFingerprint(task.findings.sourceRaw));
  });

  test.each(['noCandidates', 'oneCandidateStateDiffers'] as const)(
    '%s, with fewer than 2 candidates, is a no-match task',
    (key) => {
      expect(identityTaskFields(key).mismatchReason).toBe('no match');
    },
  );

  test('generated findings pass the seed findings validator', () => {
    expect(() =>
      validators.assertTrusteeMatchFindingsValid(
        identityTaskFields('oneCandidateStateDiffers'),
        'oneCandidateStateDiffers',
      ),
    ).not.toThrow();
  });
});

describe('scenarioTrusteeDocuments', () => {
  test("returns each scenario's trustees once, as searchable trustee documents", () => {
    const documents = scenarioTrusteeDocuments('multipleCandidates', 'multipleCandidates');

    expect(documents.map((document) => document.trusteeId)).toEqual([
      'seed-trustee-match-multi-a',
      'seed-trustee-match-multi-b',
    ]);
    expect(documents[0]).toMatchObject({
      id: 'seed-trustee-match-multi-a',
      documentType: 'TRUSTEE',
      name: 'Taylor Multimatch',
      phoneticTokens: generateSearchTokens('Taylor Multimatch'),
    });
  });
});
