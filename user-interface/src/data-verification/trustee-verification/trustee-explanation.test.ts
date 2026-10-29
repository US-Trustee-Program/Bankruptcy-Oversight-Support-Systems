import {
  ProjectedTrustee,
  ScoreByScorer,
  SerializedCandidate,
  TrusteeSerializedState,
} from '@common/cams/trustee-match-pipeline';
import MockData from '@common/cams/test-utilities/mock-data';
import { buildTrusteeExplanation } from './trustee-explanation';

function candidate(scores: ScoreByScorer): SerializedCandidate<ProjectedTrustee> {
  return {
    camsRaw: {
      trusteeId: 't1',
      firstName: 'Trustee',
      lastName: 'One',
      name: 'Trustee One',
    },
    camsNormalized: {},
    memo: {},
    scores,
    origin: 'recallBySurnameExact',
  };
}

function findings(
  candidates: SerializedCandidate<ProjectedTrustee>[],
  overrides: Partial<TrusteeSerializedState> = {},
): TrusteeSerializedState {
  return {
    sourceRaw: { fullName: 'Jane Q. Doe' },
    sourceNormalized: {},
    memo: {},
    candidates,
    match: null,
    skip: false,
    error: null,
    ...overrides,
  };
}

const EXACT_NAME: ScoreByScorer = { doesNameMatch: { pass: true, quality: 'exact' } };

describe('buildTrusteeExplanation', () => {
  test('zero candidates: generic "does not match any" sentence', () => {
    const explanation = buildTrusteeExplanation(findings([]));
    expect(explanation.sentence).toBe(
      'Trustee information sent to CAMS does not match any trustee in CAMS.',
    );
    expect(explanation.showNameInterpretation).toBe(false);
  });

  test('two or more candidates: generic "matches multiple" sentence', () => {
    const explanation = buildTrusteeExplanation(
      findings([candidate(EXACT_NAME), candidate(EXACT_NAME)]),
    );
    expect(explanation.sentence).toBe(
      'Trustee information sent to CAMS matches multiple trustees in CAMS.',
    );
    expect(explanation.showNameInterpretation).toBe(false);
  });

  test('one candidate, nothing differs: falls back to "information", singular verb', () => {
    const explanation = buildTrusteeExplanation(findings([candidate(EXACT_NAME)]));
    expect(explanation.sentence).toBe(
      'Trustee information sent to CAMS does not exactly match a trustee in CAMS.',
    );
  });

  test('one candidate, only state differs', () => {
    const explanation = buildTrusteeExplanation(
      findings([candidate({ ...EXACT_NAME, doesStateMatch: { pass: false } })]),
    );
    expect(explanation.sentence).toBe(
      'Trustee state sent to CAMS does not exactly match a trustee in CAMS.',
    );
  });

  test('one candidate, street/city/zip differences collapse to a single "address" group', () => {
    const explanation = buildTrusteeExplanation(
      findings([
        candidate({
          ...EXACT_NAME,
          doesAddressMatch: { pass: false, streetCloseness: 0.5 },
          doesCityMatch: { pass: false },
          doesZipCodeMatch: { pass: false },
        }),
      ]),
    );
    expect(explanation.sentence).toBe(
      'Trustee address sent to CAMS does not exactly match a trustee in CAMS.',
    );
  });

  test('one candidate, address and phone differ: plural verb, fixed order', () => {
    const explanation = buildTrusteeExplanation(
      findings([
        candidate({
          ...EXACT_NAME,
          doesAddressMatch: { pass: false, streetCloseness: 0 },
          doesPhoneMatch: { pass: false },
        }),
      ]),
    );
    expect(explanation.sentence).toBe(
      'Trustee address and phone sent to CAMS do not exactly match a trustee in CAMS.',
    );
  });

  test('one candidate, name/zip/email differ: three groups joined with no serial comma', () => {
    const explanation = buildTrusteeExplanation(
      findings([
        candidate({
          doesNameMatch: { pass: false },
          doesZipCodeMatch: { pass: false },
          doesEmailMatch: { pass: false },
        }),
      ]),
    );
    expect(explanation.sentence).toBe(
      'Trustee name, address and email sent to CAMS do not exactly match a trustee in CAMS.',
    );
  });

  test('one candidate, non-exact name: shows the name interpretation', () => {
    const explanation = buildTrusteeExplanation(
      findings([candidate({ doesNameMatch: { pass: true, quality: 'weak' } })]),
    );
    expect(explanation.showNameInterpretation).toBe(true);
  });

  test('one candidate, failed name match: shows the name interpretation', () => {
    const explanation = buildTrusteeExplanation(
      findings([candidate({ doesNameMatch: { pass: false } })]),
    );
    expect(explanation.showNameInterpretation).toBe(true);
  });

  test('one candidate, no doesNameMatch record: reuses differs.name, so no interpretation', () => {
    // The pipeline always scores name (it drives recall), so this never happens with real
    // findings. differingRows treats a missing scorer as neutral/not-differing for every other
    // field, and the mapper reuses that same flag for name, so it stays consistent here too.
    const explanation = buildTrusteeExplanation(findings([candidate({})]));
    expect(explanation.showNameInterpretation).toBe(false);
  });

  test('one candidate, exact name: does not show the name interpretation', () => {
    const explanation = buildTrusteeExplanation(findings([candidate(EXACT_NAME)]));
    expect(explanation.showNameInterpretation).toBe(false);
  });

  describe('against pipeline-generated scenarios', () => {
    test('oneCandidateStateDiffers reads "state"', () => {
      const scenario = MockData.getTrusteeMatchScenarioFindings('oneCandidateStateDiffers');
      const explanation = buildTrusteeExplanation(scenario);
      expect(explanation.sentence).toBe(
        'Trustee state sent to CAMS does not exactly match a trustee in CAMS.',
      );
      expect(explanation.showNameInterpretation).toBe(false);
    });

    test('oneCandidateAddressAndPhoneDiffer reads a non-exact name and shows the name section', () => {
      const scenario = MockData.getTrusteeMatchScenarioFindings(
        'oneCandidateAddressAndPhoneDiffer',
      );
      const explanation = buildTrusteeExplanation(scenario);
      expect(explanation.showNameInterpretation).toBe(true);
      expect(explanation.sentence).toMatch(/^Trustee .* sent to CAMS do not exactly match/);
    });

    test('oneCandidateExactName does not show the name section', () => {
      const scenario = MockData.getTrusteeMatchScenarioFindings('oneCandidateExactName');
      const explanation = buildTrusteeExplanation(scenario);
      expect(explanation.showNameInterpretation).toBe(false);
    });

    test('multipleCandidates reads the generic multiple-match sentence', () => {
      const scenario = MockData.getTrusteeMatchScenarioFindings('multipleCandidates');
      const explanation = buildTrusteeExplanation(scenario);
      expect(explanation.sentence).toBe(
        'Trustee information sent to CAMS matches multiple trustees in CAMS.',
      );
    });

    test('noCandidates reads the generic no-match sentence', () => {
      const scenario = MockData.getTrusteeMatchScenarioFindings('noCandidates');
      const explanation = buildTrusteeExplanation(scenario);
      expect(explanation.sentence).toBe(
        'Trustee information sent to CAMS does not match any trustee in CAMS.',
      );
    });
  });
});
