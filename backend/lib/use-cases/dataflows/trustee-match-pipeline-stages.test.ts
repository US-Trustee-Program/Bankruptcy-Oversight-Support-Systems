import { vi } from 'vitest';
import { DxtrTrusteeParty } from '@common/cams/dataflow-events';
import { Trustee } from '@common/cams/trustees';
import MockData from '@common/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import {
  addCandidate,
  addScore,
  createInitialState,
  mergedScore,
  PipelineState,
  projectTrustee,
} from './trustee-match-pipeline';
import * as trusteeMatchHelpers from './trustee-match.helpers';
import {
  surnameExactDiscoveryStage,
  tokenIntersectionDiscoveryStage,
  anchoredLevenshteinDiscoveryStage,
  nameScoreStage,
  similarityDiagnosticsStage,
  stateFilterStage,
  corroborationStage,
  comparativeCorroborationStage,
} from './trustee-match-pipeline-stages';

const makeDxtrTrustee = (overrides: Partial<DxtrTrusteeParty> = {}): DxtrTrusteeParty => ({
  fullName: 'John Doe',
  firstName: 'John',
  lastName: 'Doe',
  ...overrides,
});

const makeTrustee = (overrides: Partial<Trustee> = {}): Trustee =>
  MockData.getTrustee({ firstName: 'John', lastName: 'Doe', ...overrides });

describe('surnameExactDiscoveryStage', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  test('adds every surname-exact candidate found to the pipeline state', async () => {
    const johnMoon = makeTrustee({
      trusteeId: 't1',
      firstName: 'John',
      lastName: 'Moon',
      name: 'John P. Moon',
    });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockResolvedValue([johnMoon]);

    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'Phillip A Moon', lastName: 'Moon' }),
    );

    const result = await surnameExactDiscoveryStage(context)(state);

    expect(result.candidates.has('t1')).toBe(true);
    expect(result.candidates.get('t1')!.camsRaw.name).toBe('John P. Moon');
  });

  test('no-ops once the pipeline has already matched', async () => {
    const searchSpy = vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName');
    const state: PipelineState = {
      ...createInitialState(makeDxtrTrustee()),
      match: { trusteeId: 'already-matched', score: {} },
    };

    const result = await surnameExactDiscoveryStage(context)(state);

    expect(searchSpy).not.toHaveBeenCalled();
    expect(result).toBe(state);
  });

  test('no-ops once the pipeline has been skipped', async () => {
    const searchSpy = vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName');
    const state: PipelineState = { ...createInitialState(makeDxtrTrustee()), skip: true };

    const result = await surnameExactDiscoveryStage(context)(state);

    expect(searchSpy).not.toHaveBeenCalled();
    expect(result).toBe(state);
  });

  test('does not reset an existing candidate already discovered by a prior stage', async () => {
    const johnMoon = makeTrustee({ trusteeId: 't1', name: 'John P. Moon' });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockResolvedValue([johnMoon]);

    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'Phillip A Moon', lastName: 'Moon' }),
    );
    const existingCandidate = addCandidate(state, projectTrustee(johnMoon));
    addScore(existingCandidate, 'calculateNameScore', { nameScore: 42, match: false });

    const result = await surnameExactDiscoveryStage(context)(state);

    expect(result.candidates.get('t1')!.scores).toEqual({
      calculateNameScore: { nameScore: 42, match: false },
    });
  });
});

describe('tokenIntersectionDiscoveryStage', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  test('adds every token-intersection candidate found to the pipeline state', async () => {
    const bryan = makeTrustee({ trusteeId: 't1', name: 'William Wheeler Bryan' });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockImplementation(
      async (token: string) => (token === 'wheeler' || token === 'bryan' ? [bryan] : []),
    );

    const state = createInitialState(makeDxtrTrustee({ fullName: 'W. Wheeler Bryan' }));

    const result = await tokenIntersectionDiscoveryStage(context)(state);

    expect(result.candidates.has('t1')).toBe(true);
  });

  test('no-ops once the pipeline has already matched', async () => {
    const searchSpy = vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName');
    const state: PipelineState = {
      ...createInitialState(makeDxtrTrustee()),
      match: { trusteeId: 'already-matched', score: {} },
    };

    await tokenIntersectionDiscoveryStage(context)(state);

    expect(searchSpy).not.toHaveBeenCalled();
  });
});

describe('anchoredLevenshteinDiscoveryStage', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  test('adds every anchored-Levenshtein candidate found to the pipeline state', async () => {
    const darr = makeTrustee({
      trusteeId: 't1',
      firstName: 'Stephen',
      lastName: 'Darr',
      name: 'Stephen Darr',
    });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockImplementation(
      async (token: string) => (token === 'darr' ? [darr] : []),
    );

    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'Stephan Darr', firstName: 'Stephan', lastName: 'Darr' }),
    );

    const result = await anchoredLevenshteinDiscoveryStage(context)(state);

    expect(result.candidates.has('t1')).toBe(true);
  });

  test('no-ops once the pipeline has already matched', async () => {
    const searchSpy = vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName');
    const state: PipelineState = {
      ...createInitialState(makeDxtrTrustee()),
      match: { trusteeId: 'already-matched', score: {} },
    };

    await anchoredLevenshteinDiscoveryStage(context)(state);

    expect(searchSpy).not.toHaveBeenCalled();
  });
});

describe('nameScoreStage', () => {
  test('merges a nameScore and a match flag onto every candidate currently in the pipeline', async () => {
    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'John Doe', firstName: 'John', lastName: 'Doe' }),
    );
    addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'John', lastName: 'Doe' })),
    );
    addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't2', firstName: 'Someone', lastName: 'Else' })),
    );

    const result = await nameScoreStage()(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
      nameScore: 100,
    });
    expect(mergedScore(result.candidates.get('t2')!)).toMatchObject({
      nameScore: 0,
    });
  });

  test('no-ops once the pipeline has already matched', async () => {
    const state: PipelineState = {
      ...createInitialState(makeDxtrTrustee()),
      match: { trusteeId: 'already-matched', score: {} },
    };
    addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));

    const result = await nameScoreStage()(state);

    expect(result.candidates.get('t1')!.scores).toEqual({});
  });

  test("preserves an earlier stage's score keys via cumulative merge", async () => {
    const state = createInitialState(makeDxtrTrustee({ firstName: 'John', lastName: 'Doe' }));
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'John', lastName: 'Doe' })),
    );
    addScore(candidate, 'stateFilterStage', { stateMatch: true });

    const result = await nameScoreStage()(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
      stateMatch: true,
      nameScore: 100,
    });
  });
});

describe('similarityDiagnosticsStage', () => {
  test('memoizes fullNameSimilarity and tokenNameMatchRate onto every candidate currently in the pipeline', async () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: 'John Doe' }));
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'John Doe' })),
    );

    const result = await similarityDiagnosticsStage()(state);

    expect(result.candidates.get('t1')).toBe(candidate);
    expect(candidate.camsNormalized.get('fullNameSimilarity')).toEqual([
      { key: 'john doe|john doe', value: 1 },
    ]);
    expect(candidate.camsNormalized.get('tokenNameMatchRate')).toEqual([
      { key: 'john doe|john doe', value: 1 },
    ]);
  });

  test('never writes a ScoreEntry - this stage is diagnostic only, never gates match/skip', async () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: 'John Doe' }));
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Else' })),
    );

    await similarityDiagnosticsStage()(state);

    expect(candidate.scores).toEqual({});
  });

  test('memoizes the ACMS-side normalized name once on state.acmsNormalized rather than recomputing it per candidate', async () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: 'John Doe' }));
    addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Jane Smith' })));
    addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't2', name: 'Bob Jones' })));

    await similarityDiagnosticsStage()(state);

    expect(state.acmsNormalized.get('normalizeForSimilarity')).toEqual([
      { key: 'John Doe', value: 'john doe' },
    ]);
  });

  test("memoizes each candidate's own normalized name once, reused by both fullNameSimilarity and tokenNameMatchRate", async () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: 'John Doe' }));
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: "O'Brien-Smith" })),
    );

    await similarityDiagnosticsStage()(state);

    expect(candidate.camsNormalized.get('normalizeForSimilarity')).toEqual([
      { key: "O'Brien-Smith", value: 'obrien smith' },
    ]);
  });

  test('no-ops once the pipeline has already matched', async () => {
    const state: PipelineState = {
      ...createInitialState(makeDxtrTrustee()),
      match: { trusteeId: 'already-matched', score: {} },
    };
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));

    await similarityDiagnosticsStage()(state);

    expect(candidate.camsNormalized.has('fullNameSimilarity')).toBe(false);
  });
});

describe('stateFilterStage', () => {
  const dxtrInWashington = makeDxtrTrustee({
    fullName: 'Phillip A Moon',
    firstName: 'Phillip',
    middleName: 'A',
    lastName: 'Moon',
    legacy: { cityStateZipCountry: 'Tacoma, WA 98402' },
  });

  const addTrustee = (state: PipelineState, overrides: Partial<Trustee> = {}) =>
    addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          firstName: 'Someone',
          lastName: 'Moon',
          name: 'Someone Moon',
          ...overrides,
        }),
      ),
    );

  test('annotates a state-mismatched candidate even in a small pool - runs regardless of pool size', async () => {
    const state = createInitialState(dxtrInWashington);
    addTrustee(state, {
      trusteeId: 'trustee-fl',
      firstName: 'Nobody',
      name: 'Nobody Moon',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Miami',
          state: 'FL',
          zipCode: '33101',
          countryCode: 'US',
        },
      },
    });

    const result = await stateFilterStage()(state);

    expect(mergedScore(result.candidates.get('trustee-fl')!)).toMatchObject({
      stateMatch: false,
    });
  });

  test('annotates a state-mismatched candidate in a large pool too', async () => {
    const state = createInitialState(dxtrInWashington);
    addTrustee(state, {
      trusteeId: 'trustee-wa',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Seattle',
          state: 'WA',
          zipCode: '98101',
          countryCode: 'US',
        },
      },
    });
    for (let i = 0; i < 5; i++) {
      addTrustee(state, {
        trusteeId: `trustee-fl-${i}`,
        firstName: 'Nobody',
        name: 'Nobody Moon',
        public: {
          address: {
            address1: '1 Elm St',
            city: 'Miami',
            state: 'FL',
            zipCode: '33101',
            countryCode: 'US',
          },
        },
      });
    }

    const result = await stateFilterStage()(state);

    expect(mergedScore(result.candidates.get('trustee-wa')!)).toMatchObject({
      stateMatch: true,
    });
    expect(mergedScore(result.candidates.get('trustee-fl-0')!)).toMatchObject({
      stateMatch: false,
    });
  });

  test('does NOT mark a state-mismatched candidate as mismatched when it has an exact phone match', async () => {
    const state = createInitialState({
      ...dxtrInWashington,
      legacy: { ...dxtrInWashington.legacy, phone: '2065551212' },
    });
    addTrustee(state, {
      trusteeId: 'trustee-fl-phone',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Miami',
          state: 'FL',
          zipCode: '33101',
          countryCode: 'US',
        },
        phone: { number: '206-555-1212' },
      },
    });
    for (let i = 0; i < 5; i++) {
      addTrustee(state, {
        trusteeId: `trustee-fl-${i}`,
        firstName: 'Nobody',
        name: 'Nobody Moon',
        public: {
          address: {
            address1: '1 Elm St',
            city: 'Miami',
            state: 'FL',
            zipCode: '33101',
            countryCode: 'US',
          },
        },
      });
    }

    const result = await stateFilterStage()(state);

    expect(mergedScore(result.candidates.get('trustee-fl-phone')!)).toMatchObject({
      stateMatch: true,
    });
  });

  test('does NOT mark a state-mismatched candidate as mismatched when its nameScore would be >= 85', async () => {
    const state = createInitialState(dxtrInWashington);
    addTrustee(state, {
      trusteeId: 'trustee-fl-name',
      firstName: 'Phillip',
      middleName: 'A',
      lastName: 'Moon',
      name: 'Phillip A. Moon',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Miami',
          state: 'FL',
          zipCode: '33101',
          countryCode: 'US',
        },
      },
    });
    for (let i = 0; i < 5; i++) {
      addTrustee(state, {
        trusteeId: `trustee-fl-${i}`,
        firstName: 'Nobody',
        name: 'Nobody Moon',
        public: {
          address: {
            address1: '1 Elm St',
            city: 'Miami',
            state: 'FL',
            zipCode: '33101',
            countryCode: 'US',
          },
        },
      });
    }

    const result = await stateFilterStage()(state);

    expect(mergedScore(result.candidates.get('trustee-fl-name')!)).toMatchObject({
      stateMatch: true,
    });
  });

  test('does not mark anything mismatched when the ACMS address has no parseable state', async () => {
    const state = createInitialState({
      ...dxtrInWashington,
      legacy: { cityStateZipCountry: undefined },
    });
    for (let i = 0; i < 6; i++) {
      addTrustee(state, {
        trusteeId: `trustee-${i}`,
        public: {
          address: {
            address1: '1 Elm St',
            city: 'Miami',
            state: 'FL',
            zipCode: '33101',
            countryCode: 'US',
          },
        },
      });
    }

    const result = await stateFilterStage()(state);

    for (const candidate of result.candidates.values()) {
      expect(mergedScore(candidate)).toMatchObject({ stateMatch: true });
    }
  });

  test('does not mark a candidate with no CAMS state as mismatched', async () => {
    const state = createInitialState(dxtrInWashington);
    addTrustee(state, {
      trusteeId: 'trustee-no-state',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Unknown',
          state: '',
          zipCode: '',
          countryCode: 'US',
        },
      },
    });
    for (let i = 0; i < 5; i++) {
      addTrustee(state, {
        trusteeId: `trustee-fl-${i}`,
        firstName: 'Nobody',
        name: 'Nobody Moon',
        public: {
          address: {
            address1: '1 Elm St',
            city: 'Miami',
            state: 'FL',
            zipCode: '33101',
            countryCode: 'US',
          },
        },
      });
    }

    const result = await stateFilterStage()(state);

    expect(mergedScore(result.candidates.get('trustee-no-state')!)).toMatchObject({
      stateMatch: true,
    });
  });

  test('no-ops once the pipeline has already matched', async () => {
    const state: PipelineState = {
      ...createInitialState(dxtrInWashington),
      match: { trusteeId: 'already-matched', score: {} },
    };
    addTrustee(state, { trusteeId: 't1' });

    const result = await stateFilterStage()(state);

    expect(result.candidates.get('t1')!.scores).toEqual({});
  });
});

describe('corroborationStage', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  test('sets state.match when resolveByContactCorroboration resolves', async () => {
    const state = createInitialState(makeDxtrTrustee());
    addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));
    vi.spyOn(trusteeMatchHelpers, 'resolveByContactCorroboration').mockResolvedValue({
      kind: 'resolved',
      trusteeId: 't1',
      candidateScores: [{ trusteeId: 't1', nameScore: 100 } as never],
    });

    const result = await corroborationStage(context)(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: { trusteeId: 't1', nameScore: 100 },
    });
  });

  test('falls through to resolveDuplicateNameCandidates when contact corroboration is unresolved', async () => {
    const state = createInitialState(makeDxtrTrustee());
    addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));
    addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't2' })));
    vi.spyOn(trusteeMatchHelpers, 'resolveByContactCorroboration').mockResolvedValue({
      kind: 'unresolved',
      candidateScores: [],
    });
    vi.spyOn(trusteeMatchHelpers, 'resolveDuplicateNameCandidates').mockResolvedValue({
      kind: 'resolved-duplicate',
      trusteeId: 't2',
      candidateScores: [{ trusteeId: 't2', nameScore: 100 } as never],
    });

    const result = await corroborationStage(context)(state);

    expect(result.match).toEqual({
      trusteeId: 't2',
      score: { trusteeId: 't2', nameScore: 100 },
    });
  });

  test('leaves state.match null when neither corroboration path resolves', async () => {
    const state = createInitialState(makeDxtrTrustee());
    addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));
    vi.spyOn(trusteeMatchHelpers, 'resolveByContactCorroboration').mockResolvedValue({
      kind: 'unresolved',
      candidateScores: [],
    });
    vi.spyOn(trusteeMatchHelpers, 'resolveDuplicateNameCandidates').mockResolvedValue({
      kind: 'unresolved',
      candidateScores: [],
    });

    const result = await corroborationStage(context)(state);

    expect(result.match).toBeNull();
  });

  test('excludes candidates flagged stateMatch: false by an earlier stage from the ids passed to corroboration', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const mismatched = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));
    addScore(mismatched, 'stateFilterStage', { stateMatch: false });
    addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't2' })));
    const corroborationSpy = vi
      .spyOn(trusteeMatchHelpers, 'resolveByContactCorroboration')
      .mockResolvedValue({ kind: 'unresolved', candidateScores: [] });
    vi.spyOn(trusteeMatchHelpers, 'resolveDuplicateNameCandidates').mockResolvedValue({
      kind: 'unresolved',
      candidateScores: [],
    });

    await corroborationStage(context)(state);

    expect(corroborationSpy).toHaveBeenCalledWith(context, state.acmsRaw, ['t2']);
  });

  test('no-ops once the pipeline has already matched', async () => {
    const corroborationSpy = vi.spyOn(trusteeMatchHelpers, 'resolveByContactCorroboration');
    const state: PipelineState = {
      ...createInitialState(makeDxtrTrustee()),
      match: { trusteeId: 'already-matched', score: {} },
    };

    await corroborationStage(context)(state);

    expect(corroborationSpy).not.toHaveBeenCalled();
  });
});

describe('comparativeCorroborationStage', () => {
  // Models SE-06869: ACMS "Andrew Wilson" (Seattle WA, phone 206-850-8777) has two CAMS
  // candidates that both clear calculateNameScore's 85 threshold - "A. Bruce Wilson" (Fort Worth
  // TX, unrelated phone) and "J. Andrew Wilson" (Seattle WA, phone 206-850-8777, an EXACT match).
  // resolveByContactCorroboration refuses to arbitrate between multiple name-qualifying candidates
  // at all (see trustee-match.helpers.ts) - this stage exists specifically to pick up that case
  // when exactly one qualifying candidate has decisive contact evidence the others lack.
  const acmsAndrewWilson = makeDxtrTrustee({
    fullName: 'Andrew Wilson',
    firstName: 'Andrew',
    lastName: 'Wilson',
    legacy: {
      address1: 'PO Box 573',
      cityStateZipCountry: 'Edmonds, WA 98020',
      phone: '2068508777',
    },
  });

  test('resolves to the sole candidate with an exact phone match among multiple name-qualifying candidates', async () => {
    const state = createInitialState(acmsAndrewWilson);
    const bruceWilson = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'bruce-wilson',
          firstName: 'A.',
          middleName: 'Bruce',
          lastName: 'Wilson',
          name: 'A. Bruce Wilson',
          public: {
            address: {
              address1: '1300 S. University Dr. #308',
              city: 'Ft. Worth',
              state: 'TX',
              zipCode: '76107',
              countryCode: 'US',
            },
            phone: { number: '817-877-4400' },
          },
        }),
      ),
    );
    addScore(bruceWilson, 'calculateNameScore', { nameScore: 85, match: true });
    const andrewWilson = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'j-andrew-wilson',
          firstName: 'J.',
          middleName: 'Andrew',
          lastName: 'Wilson',
          name: 'J. Andrew Wilson',
          public: {
            address: {
              address1: '403 Galer Street',
              city: 'Seattle',
              state: 'WA',
              zipCode: '98109',
              countryCode: 'US',
            },
            phone: { number: '206-850-8777' },
          },
        }),
      ),
    );
    addScore(andrewWilson, 'calculateNameScore', { nameScore: 85, match: true });

    const result = await comparativeCorroborationStage()(state);

    expect(result.match).toEqual({
      trusteeId: 'j-andrew-wilson',
      score: expect.objectContaining({ phoneScore: 100 }),
    });
  });

  test('does not resolve when more than one qualifying candidate has strong corroboration', async () => {
    const state = createInitialState(acmsAndrewWilson);
    const first = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'candidate-1',
          name: 'Andrew Wilson',
          public: {
            address: {
              address1: '1 Unrelated St',
              city: 'Nowhere',
              state: 'ZZ',
              zipCode: '00000',
              countryCode: 'US',
            },
            phone: { number: '206-850-8777' },
          },
        }),
      ),
    );
    addScore(first, 'calculateNameScore', { nameScore: 85, match: true });
    const second = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'candidate-2',
          name: 'Andrew J. Wilson',
          public: {
            address: {
              address1: '1 Unrelated St',
              city: 'Nowhere',
              state: 'ZZ',
              zipCode: '00000',
              countryCode: 'US',
            },
            phone: { number: '206-850-8777' },
          },
        }),
      ),
    );
    addScore(second, 'calculateNameScore', { nameScore: 85, match: true });

    const result = await comparativeCorroborationStage()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when no qualifying candidate has strong corroboration', async () => {
    const state = createInitialState(acmsAndrewWilson);
    const first = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'candidate-1',
          name: 'Andrew Wilson',
          public: {
            address: {
              address1: '1 Elm St',
              city: 'Miami',
              state: 'FL',
              zipCode: '33101',
              countryCode: 'US',
            },
            phone: { number: '305-555-1212' },
          },
        }),
      ),
    );
    addScore(first, 'calculateNameScore', { nameScore: 85, match: true });
    const second = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'candidate-2',
          name: 'Andrew J. Wilson',
          public: {
            address: {
              address1: '1 Oak St',
              city: 'Denver',
              state: 'CO',
              zipCode: '80202',
              countryCode: 'US',
            },
            phone: { number: '303-555-1212' },
          },
        }),
      ),
    );
    addScore(second, 'calculateNameScore', { nameScore: 85, match: true });

    const result = await comparativeCorroborationStage()(state);

    expect(result.match).toBeNull();
  });

  test('ignores candidates that never cleared the name-score threshold', async () => {
    const state = createInitialState(acmsAndrewWilson);
    const nameNoMatch = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'jason-wilson-aguilar',
          name: 'Jason Wilson-Aguilar',
          public: {
            address: {
              address1: '1 Unrelated St',
              city: 'Nowhere',
              state: 'ZZ',
              zipCode: '00000',
              countryCode: 'US',
            },
            phone: { number: '206-850-8777' },
          },
        }),
      ),
    );
    addScore(nameNoMatch, 'calculateNameScore', { nameScore: 0, match: false });

    const result = await comparativeCorroborationStage()(state);

    expect(result.match).toBeNull();
  });

  test('records addressScore/phoneScore onto every qualifying candidate regardless of outcome', async () => {
    const state = createInitialState(acmsAndrewWilson);
    const bruceWilson = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'bruce-wilson',
          name: 'A. Bruce Wilson',
          public: {
            address: {
              address1: '1300 S. University Dr. #308',
              city: 'Ft. Worth',
              state: 'TX',
              zipCode: '76107',
              countryCode: 'US',
            },
            phone: { number: '817-877-4400' },
          },
        }),
      ),
    );
    addScore(bruceWilson, 'calculateNameScore', { nameScore: 85, match: true });
    const andrewWilson = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'j-andrew-wilson',
          name: 'J. Andrew Wilson',
          public: {
            address: {
              address1: '1 Unrelated St',
              city: 'Nowhere',
              state: 'ZZ',
              zipCode: '00000',
              countryCode: 'US',
            },
            phone: { number: '206-850-8777' },
          },
        }),
      ),
    );
    addScore(andrewWilson, 'calculateNameScore', { nameScore: 85, match: true });

    await comparativeCorroborationStage()(state);

    expect(mergedScore(bruceWilson)).toMatchObject({ phoneScore: 0 });
    expect(mergedScore(andrewWilson)).toMatchObject({ phoneScore: 100 });
  });

  test('no-ops once the pipeline has already matched', async () => {
    const state: PipelineState = {
      ...createInitialState(acmsAndrewWilson),
      match: { trusteeId: 'already-matched', score: {} },
    };
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));
    addScore(candidate, 'calculateNameScore', { nameScore: 85, match: true });

    await comparativeCorroborationStage()(state);

    expect(candidate.scores).not.toHaveProperty('contactCorroborationScore');
  });
});
