import {
  deriveDisposition,
  deriveSuspectDuplicateCamsTrustee,
} from './trustee-professional-ids.types';
import { TrusteeSerializedState, ProjectedTrustee } from './trustee-match-pipeline';
import { CamsError } from '../../common-errors/cams-error';

type Candidate = TrusteeSerializedState['candidates'][number];

function makeCandidate(
  scores: Partial<Candidate['scores']> = {},
  camsRawOverrides: Partial<ProjectedTrustee> = {},
): Candidate {
  return {
    camsRaw: { trusteeId: 't1', ...camsRawOverrides } as ProjectedTrustee,
    camsNormalized: {},
    memo: {},
    scores,
    origin: 'test',
  };
}

const passingNameMatch = {
  doesNameMatch: { pass: true, quality: 'exact' },
};

function makeState(
  overrides: Partial<Pick<TrusteeSerializedState, 'match' | 'skip' | 'error' | 'candidates'>>,
): Pick<TrusteeSerializedState, 'match' | 'skip' | 'error' | 'candidates'> {
  return {
    match: null,
    skip: false,
    error: null,
    candidates: [],
    ...overrides,
  };
}

describe('deriveDisposition', () => {
  test('returns error when state.error is set', () => {
    const state = makeState({ error: new CamsError('TEST', { message: 'boom' }) });
    expect(deriveDisposition(state)).toBe('error');
  });

  test('returns skipped when state.skip is set', () => {
    const state = makeState({ skip: true });
    expect(deriveDisposition(state)).toBe('skipped');
  });

  test('returns auto-linked when state.match is set', () => {
    const state = makeState({
      match: { trusteeId: 't1', score: {}, resolvedBy: 'test' },
    });
    expect(deriveDisposition(state)).toBe('auto-linked');
  });

  test('returns no-match when there are no candidates', () => {
    const state = makeState({ candidates: [] });
    expect(deriveDisposition(state)).toBe('no-match');
  });

  test('returns no-match when every candidate failed doesNameMatch', () => {
    const state = makeState({
      candidates: [
        makeCandidate({
          doesNameMatch: { pass: false, quality: 'strong' },
        }),
        makeCandidate({ doesNameMatch: { pass: false } }),
      ],
    });
    expect(deriveDisposition(state)).toBe('no-match');
  });

  test('returns no-match when a candidate has no doesNameMatch score at all', () => {
    const state = makeState({ candidates: [makeCandidate()] });
    expect(deriveDisposition(state)).toBe('no-match');
  });

  // 'ambiguous' means a genuine CHOICE between 2+ real, competing identities - structurally
  // impossible when only one candidate in the pool actually qualifies. A pool with exactly one
  // genuinely-qualifying candidate (here, the second one - the first fails doesNameMatch outright)
  // is 'no-match': real evidence, just not enough of it to auto-link, not a choice between
  // multiple plausible answers.
  test('returns no-match when only one candidate cleared doesNameMatch, even with a second candidate present', () => {
    const state = makeState({
      candidates: [
        makeCandidate({
          doesNameMatch: { pass: false, quality: 'strong' },
        }),
        makeCandidate({
          doesNameMatch: { pass: true, quality: 'exact' },
        }),
      ],
    });
    expect(deriveDisposition(state)).toBe('no-match');
  });

  test('returns plain ambiguous when qualifying candidates share neither phone nor email', () => {
    const state = makeState({
      candidates: [
        makeCandidate(passingNameMatch, { phone: { number: '702-262-9322' } }),
        makeCandidate(passingNameMatch, { phone: { number: '212-555-0100' } }),
      ],
    });
    expect(deriveDisposition(state)).toBe('ambiguous');
  });

  // cams-yzqkt follow-up (SP-02360): an 85-scored name match (an initial, a crossed middle name,
  // a nickname - never an exact 100) is name-shape coincidence, not real evidence, when the ACMS
  // source has no address/phone at all for corroboration to ever run against. A whole surname
  // pool worth of unrelated real trustees can each qualify this way - "ambiguous" should mean
  // genuinely competing evidence, not "the ACMS record happened to share initials with several
  // people in a big pool."
  test('returns no-match when every 85-scored candidate has no ACMS contact data to corroborate against', () => {
    const weakMatch = {
      doesNameMatch: { pass: true, quality: 'strong' },
      doesAcmsTrusteeHaveAddressAndPhone: { pass: false },
    };
    const state = makeState({
      candidates: [makeCandidate(weakMatch), makeCandidate(weakMatch), makeCandidate(weakMatch)],
    });
    expect(deriveDisposition(state)).toBe('no-match');
  });

  // 'ambiguous' requires 2+ genuinely-qualifying candidates (a real CHOICE between competing
  // identities) - a lone candidate, however strong its own evidence, is 'no-match': real evidence,
  // just not enough of it to auto-link, never a choice between multiple plausible answers. This is
  // the exact real regression this rule fixes (a real shape, name synthesized): ACMS "Jordan Roe"
  // in one state exact-name-matched a sole CAMS candidate "Jordan A. Roe" in a different state, with
  // a real, disagreeing state and near-zero address/phone corroboration - isGenuineAmbiguousEvidence's
  // exact-name-match branch alone used to be enough to call this 'ambiguous', even though there was
  // no second candidate to be ambiguous WITH. Confirmed via pipeline-replay-backtest.ts against the
  // 2026-09-25 export: 56 of 72 previously-'ambiguous' records had 0 or 1 genuinely-qualifying
  // candidates: this exact shape.
  test('returns no-match, not ambiguous, when only one candidate has an exact (100) name match with no ACMS contact data', () => {
    const state = makeState({
      candidates: [
        makeCandidate({
          doesNameMatch: { pass: true, quality: 'exact' },
          doesAcmsTrusteeHaveAddressAndPhone: { pass: false },
        }),
      ],
    });
    expect(deriveDisposition(state)).toBe('no-match');
  });

  test('returns no-match, not ambiguous, when only one 85-scored candidate has ACMS contact data to corroborate against', () => {
    const weakMatchWithComparableAcmsData = {
      doesNameMatch: { pass: true, quality: 'strong' },
      doesAcmsTrusteeHaveAddressAndPhone: { pass: true },
      doesAddressMatch: { pass: false, points: 0 },
    };
    const state = makeState({
      candidates: [makeCandidate(weakMatchWithComparableAcmsData)],
    });
    expect(deriveDisposition(state)).toBe('no-match');
  });

  test('returns ambiguous when TWO candidates each independently carry genuine competing evidence', () => {
    const exactMatch = {
      doesNameMatch: { pass: true, quality: 'exact' },
      doesAcmsTrusteeHaveAddressAndPhone: { pass: false },
    };
    const weakMatchWithComparableAcmsData = {
      doesNameMatch: { pass: true, quality: 'strong' },
      doesAcmsTrusteeHaveAddressAndPhone: { pass: true },
      doesAddressMatch: { pass: false, points: 0 },
    };
    const state = makeState({
      candidates: [makeCandidate(exactMatch), makeCandidate(weakMatchWithComparableAcmsData)],
    });
    expect(deriveDisposition(state)).toBe('ambiguous');
  });

  test('precedence: error takes priority over skip/match/candidates', () => {
    const state = makeState({
      error: new CamsError('TEST', { message: 'boom' }),
      skip: true,
      match: { trusteeId: 't1', score: {}, resolvedBy: 'test' },
    });
    expect(deriveDisposition(state)).toBe('error');
  });

  test('precedence: skip takes priority over match/candidates', () => {
    const state = makeState({
      skip: true,
      match: { trusteeId: 't1', score: {}, resolvedBy: 'test' },
    });
    expect(deriveDisposition(state)).toBe('skipped');
  });
});

describe('deriveSuspectDuplicateCamsTrustee', () => {
  test('returns true when 2+ qualifying candidates share a phone number', () => {
    const state = makeState({
      candidates: [
        makeCandidate(passingNameMatch, { phone: { number: '702-262-9322' } }),
        makeCandidate(passingNameMatch, { phone: { number: '7022629322' } }),
      ],
    });
    expect(deriveSuspectDuplicateCamsTrustee(state)).toBe(true);
  });

  test('returns true when 2+ qualifying candidates share an email', () => {
    const state = makeState({
      candidates: [
        makeCandidate(passingNameMatch, { email: 'jane@example.com' }),
        makeCandidate(passingNameMatch, { email: 'Jane@Example.com' }),
      ],
    });
    expect(deriveSuspectDuplicateCamsTrustee(state)).toBe(true);
  });

  test('returns true when 2+ qualifying candidates share a street address', () => {
    const state = makeState({
      candidates: [
        makeCandidate(passingNameMatch, {
          address: {
            address1: '4095 Huffman Mill Road',
            city: 'Lexington',
            state: 'KY',
            zipCode: '40511',
            countryCode: 'US',
          },
        }),
        makeCandidate(passingNameMatch, {
          address: {
            address1: '4095 Huffman Mill Rd.',
            city: 'Lexington',
            state: 'KY',
            zipCode: '40511',
            countryCode: 'US',
          },
        }),
      ],
    });
    expect(deriveSuspectDuplicateCamsTrustee(state)).toBe(true);
  });

  test('returns false when candidates share only a city/state/zip, no street address', () => {
    const state = makeState({
      candidates: [
        makeCandidate(passingNameMatch, {
          address: {
            address1: '',
            city: 'Lexington',
            state: 'KY',
            zipCode: '40511',
            countryCode: 'US',
          },
        }),
        makeCandidate(passingNameMatch, {
          address: {
            address1: '',
            city: 'Lexington',
            state: 'KY',
            zipCode: '40511',
            countryCode: 'US',
          },
        }),
      ],
    });
    expect(deriveSuspectDuplicateCamsTrustee(state)).toBe(false);
  });

  test('returns false when qualifying candidates share neither phone, email, nor address', () => {
    const state = makeState({
      candidates: [
        makeCandidate(passingNameMatch, { phone: { number: '702-262-9322' } }),
        makeCandidate(passingNameMatch, { phone: { number: '212-555-0100' } }),
      ],
    });
    expect(deriveSuspectDuplicateCamsTrustee(state)).toBe(false);
  });

  test('does not treat a shared phone on a NON-qualifying candidate as a duplication signal', () => {
    const state = makeState({
      candidates: [
        makeCandidate(passingNameMatch, { phone: { number: '702-262-9322' } }),
        makeCandidate(
          { doesNameMatch: { pass: false, quality: 'strong' } },
          { phone: { number: '702-262-9322' } },
        ),
      ],
    });
    expect(deriveSuspectDuplicateCamsTrustee(state)).toBe(false);
  });
});
