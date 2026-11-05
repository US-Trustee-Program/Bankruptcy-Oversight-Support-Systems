import {
  createLinkedStateWithoutEvidence,
  deriveDisposition,
  deriveNameMatchCount,
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

  test('returns linked when state.match is set', () => {
    const state = makeState({
      match: { trusteeId: 't1', score: {}, resolvedBy: 'test' },
    });
    expect(deriveDisposition(state)).toBe('linked');
  });

  test('returns no-match when there are no candidates', () => {
    const state = makeState({ candidates: [] });
    expect(deriveDisposition(state)).toBe('no-match');
  });

  test('returns no-match when every candidate failed doesNameMatch', () => {
    const state = makeState({
      candidates: [
        makeCandidate({
          doesNameMatch: { pass: false },
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

  test('returns ambiguous when two candidates are exact name matches', () => {
    const state = makeState({
      candidates: [makeCandidate(passingNameMatch), makeCandidate(passingNameMatch)],
    });
    expect(deriveDisposition(state)).toBe('ambiguous');
  });

  // Any passing name that is not exact (strong, or weak = a fuzzy surname with an identical first
  // name) is evidence only when the source has contact data to compare against. A missing score is
  // not a failed one, so it does not disqualify a rival.
  test.each(['strong', 'weak'])(
    'returns no-match when every candidate is only a %s name match and the source has no contact data',
    (quality) => {
      const match = {
        doesNameMatch: { pass: true, quality },
        doesSourceTrusteeHaveAddressAndPhone: { pass: false },
      };
      const state = makeState({
        candidates: [makeCandidate(match), makeCandidate(match), makeCandidate(match)],
      });
      expect(deriveDisposition(state)).toBe('no-match');
    },
  );

  test.each(['strong', 'weak'])(
    'returns ambiguous when two %s-name candidates have no source contact-data score at all',
    (quality) => {
      const match = { doesNameMatch: { pass: true, quality } };
      const state = makeState({ candidates: [makeCandidate(match), makeCandidate(match)] });
      expect(deriveDisposition(state)).toBe('ambiguous');
    },
  );

  test.each(['strong', 'weak'])(
    'returns ambiguous when two %s-name candidates and the source has contact data',
    (quality) => {
      const match = {
        doesNameMatch: { pass: true, quality },
        doesSourceTrusteeHaveAddressAndPhone: { pass: true },
      };
      const state = makeState({ candidates: [makeCandidate(match), makeCandidate(match)] });
      expect(deriveDisposition(state)).toBe('ambiguous');
    },
  );

  test('returns ambiguous when an exact name and a strong name with source contact data compete', () => {
    const exactMatch = {
      doesNameMatch: { pass: true, quality: 'exact' },
      doesSourceTrusteeHaveAddressAndPhone: { pass: false },
    };
    const strongMatchWithSourceContact = {
      doesNameMatch: { pass: true, quality: 'strong' },
      doesSourceTrusteeHaveAddressAndPhone: { pass: true },
    };
    const state = makeState({
      candidates: [makeCandidate(exactMatch), makeCandidate(strongMatchWithSourceContact)],
    });
    expect(deriveDisposition(state)).toBe('ambiguous');
  });

  // The discovery tiers keep a candidate that fails the name check when its state does not
  // conflict, so a pool of 2 can hold only one name-passing candidate.
  test.each(['exact', 'strong', 'weak'])(
    'returns no-match when the pool has 2 candidates but only one (%s) passes the name check',
    (quality) => {
      const state = makeState({
        candidates: [
          makeCandidate({ doesNameMatch: { pass: true, quality } }),
          makeCandidate({ doesNameMatch: { pass: false } }),
        ],
      });
      expect(deriveDisposition(state)).toBe('no-match');
    },
  );

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

describe('deriveNameMatchCount', () => {
  test('counts the candidates whose name matches, at any grade', () => {
    const state = makeState({
      candidates: [
        makeCandidate(passingNameMatch),
        makeCandidate({ doesNameMatch: { pass: true, quality: 'weak' } }),
        makeCandidate({ doesNameMatch: { pass: false } }),
      ],
    });

    expect(deriveNameMatchCount(state)).toBe(2);
  });

  test('returns 0 when there are no candidates', () => {
    expect(deriveNameMatchCount(makeState({}))).toBe(0);
  });
});

describe('deriveSuspectDuplicateCamsTrustee', () => {
  test('returns false when candidates share only a phone number too short to compare', () => {
    const state = makeState({
      candidates: [
        makeCandidate(passingNameMatch, { phone: { number: '555-0100' } }),
        makeCandidate(passingNameMatch, { phone: { number: '555-0100' } }),
      ],
    });
    expect(deriveSuspectDuplicateCamsTrustee(state)).toBe(false);
  });

  test('returns false when candidates share only a blank email', () => {
    const state = makeState({
      candidates: [
        makeCandidate(passingNameMatch, { email: '   ' }),
        makeCandidate(passingNameMatch, { email: '   ' }),
      ],
    });
    expect(deriveSuspectDuplicateCamsTrustee(state)).toBe(false);
  });

  test('returns false when candidates share only a punctuation-only street line and nothing else', () => {
    const punctuationOnly: Partial<ProjectedTrustee> = {
      address: { address1: '.', city: '', state: '', zipCode: '', countryCode: 'US' },
    };
    const state = makeState({
      candidates: [
        makeCandidate(passingNameMatch, punctuationOnly),
        makeCandidate(passingNameMatch, punctuationOnly),
      ],
    });
    expect(deriveSuspectDuplicateCamsTrustee(state)).toBe(false);
  });

  test('returns true when 2+ qualifying candidates share a phone number', () => {
    const state = makeState({
      candidates: [
        makeCandidate(passingNameMatch, { phone: { number: '206-555-0100' } }),
        makeCandidate(passingNameMatch, { phone: { number: '2065550100' } }),
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
            address1: '1 Fictional Avenue',
            city: 'Fictionburg',
            state: 'WA',
            zipCode: '98999',
            countryCode: 'US',
          },
        }),
        makeCandidate(passingNameMatch, {
          address: {
            address1: '1 Fictional Ave.',
            city: 'Fictionburg',
            state: 'WA',
            zipCode: '98999',
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
            city: 'Fictionburg',
            state: 'WA',
            zipCode: '98999',
            countryCode: 'US',
          },
        }),
        makeCandidate(passingNameMatch, {
          address: {
            address1: '',
            city: 'Fictionburg',
            state: 'WA',
            zipCode: '98999',
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
        makeCandidate(passingNameMatch, { phone: { number: '206-555-0100' } }),
        makeCandidate(passingNameMatch, { phone: { number: '206-555-0199' } }),
      ],
    });
    expect(deriveSuspectDuplicateCamsTrustee(state)).toBe(false);
  });

  test('does not treat a shared phone on a NON-qualifying candidate as a duplication signal', () => {
    const state = makeState({
      candidates: [
        makeCandidate(passingNameMatch, { phone: { number: '206-555-0100' } }),
        makeCandidate({ doesNameMatch: { pass: false } }, { phone: { number: '206-555-0100' } }),
      ],
    });
    expect(deriveSuspectDuplicateCamsTrustee(state)).toBe(false);
  });
});

describe('createLinkedStateWithoutEvidence', () => {
  test('returns a linked state for the source with no candidates and a linkedWithoutPipelineEvidence match', () => {
    const source = { fullName: 'Jane Doe', firstName: 'Jane', lastName: 'Doe' };

    const state = createLinkedStateWithoutEvidence(source, 'trustee-9');

    expect(state).toEqual({
      sourceRaw: source,
      sourceNormalized: {},
      memo: {},
      candidates: [],
      match: { trusteeId: 'trustee-9', score: {}, resolvedBy: 'linkedWithoutPipelineEvidence' },
      skip: false,
      error: null,
    });
    expect(deriveDisposition(state)).toBe('linked');
  });
});
