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
  });

  test('two or more candidates: generic "matches multiple" sentence', () => {
    const explanation = buildTrusteeExplanation(
      findings([candidate(EXACT_NAME), candidate(EXACT_NAME)]),
    );
    expect(explanation.sentence).toBe(
      'Trustee information sent to CAMS matches multiple trustees in CAMS.',
    );
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

  test('one candidate, only city differs: reads "address"', () => {
    const explanation = buildTrusteeExplanation(
      findings([candidate({ ...EXACT_NAME, doesCityMatch: { pass: false } })]),
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

  describe('against pipeline-generated scenarios', () => {
    test('oneCandidateStateDiffers reads "state"', () => {
      const scenario = MockData.getTrusteeMatchScenarioFindings('oneCandidateStateDiffers');
      const explanation = buildTrusteeExplanation(scenario);
      expect(explanation.sentence).toBe(
        'Trustee state sent to CAMS does not exactly match a trustee in CAMS.',
      );
    });

    test('oneCandidateAddressAndPhoneDiffer reads a non-exact name', () => {
      const scenario = MockData.getTrusteeMatchScenarioFindings(
        'oneCandidateAddressAndPhoneDiffer',
      );
      const explanation = buildTrusteeExplanation(scenario);
      expect(explanation.sentence).toBe(
        'Trustee name, address and phone sent to CAMS do not exactly match a trustee in CAMS.',
      );
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
