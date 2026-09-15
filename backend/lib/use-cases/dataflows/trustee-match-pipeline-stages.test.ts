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
  stateFilterStage,
  corroborationStage,
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

  test('annotates candidates as NOT mismatched when the pool has 5 or fewer candidates, regardless of state', async () => {
    const state = createInitialState(dxtrInWashington);
    for (let i = 0; i < 5; i++) {
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

  test('annotates a state-mismatched candidate once the pool exceeds 5 candidates', async () => {
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
