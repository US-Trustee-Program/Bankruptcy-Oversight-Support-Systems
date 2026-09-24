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
    disqualifiers: [],
    origin: 'test',
  };
}

const passingNameMatch = { doesNameMatch: { value: 100, threshold: 85, pass: true } };

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
    const state = makeState({ match: { trusteeId: 't1', score: {} } });
    expect(deriveDisposition(state)).toBe('auto-linked');
  });

  test('returns no-match when there are no candidates', () => {
    const state = makeState({ candidates: [] });
    expect(deriveDisposition(state)).toBe('no-match');
  });

  test('returns no-match when every candidate failed doesNameMatch', () => {
    const state = makeState({
      candidates: [
        makeCandidate({ doesNameMatch: { value: 0, threshold: 85, pass: false } }),
        makeCandidate({ doesNameMatch: { value: 42, threshold: 85, pass: false } }),
      ],
    });
    expect(deriveDisposition(state)).toBe('no-match');
  });

  test('returns no-match when a candidate has no doesNameMatch score at all', () => {
    const state = makeState({ candidates: [makeCandidate()] });
    expect(deriveDisposition(state)).toBe('no-match');
  });

  test('returns ambiguous when at least one candidate cleared doesNameMatch', () => {
    const state = makeState({
      candidates: [
        makeCandidate({ doesNameMatch: { value: 0, threshold: 85, pass: false } }),
        makeCandidate({ doesNameMatch: { value: 100, threshold: 85, pass: true } }),
      ],
    });
    expect(deriveDisposition(state)).toBe('ambiguous');
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

  test('does not treat a shared phone/email on a NON-qualifying candidate as a duplication signal', () => {
    const state = makeState({
      candidates: [
        makeCandidate(passingNameMatch, { phone: { number: '702-262-9322' } }),
        makeCandidate(
          { doesNameMatch: { value: 0, threshold: 85, pass: false } },
          { phone: { number: '702-262-9322' } },
        ),
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
      doesNameMatch: { value: 85, threshold: 85, pass: true },
      doesAcmsTrusteeHaveAddressAndPhone: { value: 0, threshold: 100, pass: false },
    };
    const state = makeState({
      candidates: [makeCandidate(weakMatch), makeCandidate(weakMatch), makeCandidate(weakMatch)],
    });
    expect(deriveDisposition(state)).toBe('no-match');
  });

  test('returns ambiguous when an 85-scored candidate has ACMS contact data to corroborate against, even if it disagreed', () => {
    const weakMatchWithComparableAcmsData = {
      doesNameMatch: { value: 85, threshold: 85, pass: true },
      doesAcmsTrusteeHaveAddressAndPhone: { value: 100, threshold: 100, pass: true },
      contactCorroborationAddress: { value: 10, threshold: 80, pass: false },
    };
    const state = makeState({
      candidates: [makeCandidate(weakMatchWithComparableAcmsData)],
    });
    expect(deriveDisposition(state)).toBe('ambiguous');
  });

  test('returns ambiguous when a candidate has an exact (100) name match even with no ACMS contact data', () => {
    const state = makeState({
      candidates: [
        makeCandidate({
          doesNameMatch: { value: 100, threshold: 85, pass: true },
          doesAcmsTrusteeHaveAddressAndPhone: { value: 0, threshold: 100, pass: false },
        }),
      ],
    });
    expect(deriveDisposition(state)).toBe('ambiguous');
  });

  test('precedence: error takes priority over skip/match/candidates', () => {
    const state = makeState({
      error: new CamsError('TEST', { message: 'boom' }),
      skip: true,
      match: { trusteeId: 't1', score: {} },
    });
    expect(deriveDisposition(state)).toBe('error');
  });

  test('precedence: skip takes priority over match/candidates', () => {
    const state = makeState({
      skip: true,
      match: { trusteeId: 't1', score: {} },
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
          { doesNameMatch: { value: 0, threshold: 85, pass: false } },
          { phone: { number: '702-262-9322' } },
        ),
      ],
    });
    expect(deriveSuspectDuplicateCamsTrustee(state)).toBe(false);
  });
});
