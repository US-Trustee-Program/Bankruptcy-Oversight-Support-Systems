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
  phoneTypoToleranceStage,
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
    const jordanVoss = makeTrustee({
      trusteeId: 't1',
      firstName: 'Jordan',
      lastName: 'Voss',
      name: 'Jordan P. Voss',
    });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockResolvedValue([jordanVoss]);

    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'Aldric T Voss', lastName: 'Voss' }),
    );

    const result = await surnameExactDiscoveryStage(context)(state);

    expect(result.candidates.has('t1')).toBe(true);
    expect(result.candidates.get('t1')!.camsRaw.name).toBe('Jordan P. Voss');
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
    const jordanVoss = makeTrustee({ trusteeId: 't1', name: 'Jordan P. Voss' });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockResolvedValue([jordanVoss]);

    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'Aldric T Voss', lastName: 'Voss' }),
    );
    const existingCandidate = addCandidate(state, projectTrustee(jordanVoss));
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
    const cray = makeTrustee({ trusteeId: 't1', name: 'Desmond Wheeler Cray' });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockImplementation(
      async (token: string) => (token === 'wheeler' || token === 'cray' ? [cray] : []),
    );

    const state = createInitialState(makeDxtrTrustee({ fullName: 'D. Wheeler Cray' }));

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
    const falk = makeTrustee({
      trusteeId: 't1',
      firstName: 'Norbert',
      lastName: 'Falk',
      name: 'Norbert Falk',
    });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockImplementation(
      async (token: string) => (token === 'falk' ? [falk] : []),
    );

    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'Norburt Falk', firstName: 'Norburt', lastName: 'Falk' }),
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
    fullName: 'Aldric T Moon',
    firstName: 'Aldric',
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
      firstName: 'Aldric',
      middleName: 'A',
      lastName: 'Moon',
      name: 'Aldric A. Moon',
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
  // Models a real backtest finding (anonymized): an ACMS record for "Marcus Feld" (Seattle WA
  // area, a specific phone number) has two CAMS candidates that both clear calculateNameScore's
  // 85 threshold - "A. Bruce Halden" (a different state, unrelated phone) and "J. Marcus Feld"
  // (same Seattle WA area, an EXACT phone match). resolveByContactCorroboration refuses to
  // arbitrate between multiple name-qualifying candidates at all (see trustee-match.helpers.ts) -
  // this stage exists specifically to pick up that case when exactly one qualifying candidate has
  // decisive contact evidence the others lack.
  const acmsMarcusFeld = makeDxtrTrustee({
    fullName: 'Marcus Feld',
    firstName: 'Marcus',
    lastName: 'Feld',
    legacy: {
      address1: 'PO Box 100',
      cityStateZipCountry: 'Fictionville, WA 98999',
      phone: '2065551000',
    },
  });

  test('resolves to the sole candidate with an exact phone match among multiple name-qualifying candidates', async () => {
    const state = createInitialState(acmsMarcusFeld);
    const bruceHalden = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'bruce-wilson',
          firstName: 'A.',
          middleName: 'Bruce',
          lastName: 'Feld',
          name: 'A. Bruce Halden',
          public: {
            address: {
              address1: '1300 S. University Dr. #308',
              city: 'Fictionburg',
              state: 'TX',
              zipCode: '99999',
              countryCode: 'US',
            },
            phone: { number: '555-555-2000' },
          },
        }),
      ),
    );
    addScore(bruceHalden, 'calculateNameScore', { nameScore: 85, match: true });
    const marcusFeld = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'j-marcus-feld',
          firstName: 'J.',
          middleName: 'Marcus',
          lastName: 'Feld',
          name: 'J. Marcus Feld',
          public: {
            address: {
              address1: '1 Fictional Ave',
              city: 'Fictionburg',
              state: 'WA',
              zipCode: '98999',
              countryCode: 'US',
            },
            phone: { number: '206-555-1000' },
          },
        }),
      ),
    );
    addScore(marcusFeld, 'calculateNameScore', { nameScore: 85, match: true });

    const result = await comparativeCorroborationStage()(state);

    expect(result.match).toEqual({
      trusteeId: 'j-marcus-feld',
      score: expect.objectContaining({ phoneScore: 100 }),
    });
  });

  test('does not resolve when more than one qualifying candidate has strong corroboration', async () => {
    const state = createInitialState(acmsMarcusFeld);
    const first = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'candidate-1',
          name: 'Marcus Feld',
          public: {
            address: {
              address1: '1 Unrelated St',
              city: 'Nowhere',
              state: 'ZZ',
              zipCode: '00000',
              countryCode: 'US',
            },
            phone: { number: '206-555-1000' },
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
          name: 'Marcus J. Feld',
          public: {
            address: {
              address1: '1 Unrelated St',
              city: 'Nowhere',
              state: 'ZZ',
              zipCode: '00000',
              countryCode: 'US',
            },
            phone: { number: '206-555-1000' },
          },
        }),
      ),
    );
    addScore(second, 'calculateNameScore', { nameScore: 85, match: true });

    const result = await comparativeCorroborationStage()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when no qualifying candidate has strong corroboration', async () => {
    const state = createInitialState(acmsMarcusFeld);
    const first = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'candidate-1',
          name: 'Marcus Feld',
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
          name: 'Marcus J. Feld',
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
    const state = createInitialState(acmsMarcusFeld);
    const nameNoMatch = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'jason-wilson-aguilar',
          name: 'Jason Feld-Aguilar',
          public: {
            address: {
              address1: '1 Unrelated St',
              city: 'Nowhere',
              state: 'ZZ',
              zipCode: '00000',
              countryCode: 'US',
            },
            phone: { number: '206-555-1000' },
          },
        }),
      ),
    );
    addScore(nameNoMatch, 'calculateNameScore', { nameScore: 0, match: false });

    const result = await comparativeCorroborationStage()(state);

    expect(result.match).toBeNull();
  });

  test('records addressScore/phoneScore onto every qualifying candidate regardless of outcome', async () => {
    const state = createInitialState(acmsMarcusFeld);
    const bruceHalden = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'bruce-wilson',
          name: 'A. Bruce Halden',
          public: {
            address: {
              address1: '1300 S. University Dr. #308',
              city: 'Fictionburg',
              state: 'TX',
              zipCode: '99999',
              countryCode: 'US',
            },
            phone: { number: '555-555-2000' },
          },
        }),
      ),
    );
    addScore(bruceHalden, 'calculateNameScore', { nameScore: 85, match: true });
    const marcusFeld = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'j-marcus-feld',
          name: 'J. Marcus Feld',
          public: {
            address: {
              address1: '1 Unrelated St',
              city: 'Nowhere',
              state: 'ZZ',
              zipCode: '00000',
              countryCode: 'US',
            },
            phone: { number: '206-555-1000' },
          },
        }),
      ),
    );
    addScore(marcusFeld, 'calculateNameScore', { nameScore: 85, match: true });

    await comparativeCorroborationStage()(state);

    expect(mergedScore(bruceHalden)).toMatchObject({ phoneScore: 0 });
    expect(mergedScore(marcusFeld)).toMatchObject({ phoneScore: 100 });
  });

  test('no-ops once the pipeline has already matched', async () => {
    const state: PipelineState = {
      ...createInitialState(acmsMarcusFeld),
      match: { trusteeId: 'already-matched', score: {} },
    };
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));
    addScore(candidate, 'calculateNameScore', { nameScore: 85, match: true });

    await comparativeCorroborationStage()(state);

    expect(candidate.scores).not.toHaveProperty('contactCorroborationScore');
  });
});

describe('phoneTypoToleranceStage', () => {
  // Models a real backtest finding (anonymized): an ACMS record for "Terrence Boyle" has exactly
  // ONE CAMS candidate, "Terrence J. Boyle", an EXACT structured name match (nameScore=100), whose
  // recorded phone differs by exactly the LAST digit - a real, comparable, MISMATCHED number, not
  // a missing one. resolveByContactCorroboration's isNoContradictionMatch fallback never triggers
  // here - it only relaxes when phoneScore is null (uncomparable), not merely mismatched. A
  // backtest of the real 245-record population sharing this exact shape (sole candidate,
  // nameScore=100, a comparable-but-mismatched phone) found phone numbers differing by 1-2 digits
  // are essentially always a typo (still the same person), while numbers differing by 8-10 digits
  // are genuinely different phone numbers - calculatePhoneScore's binary 100-or-0 can't
  // distinguish the two, so this stage adds digit-hamming-distance as a new, pipeline-only
  // diagnostic to recover the former without touching the latter.
  const acmsTerrenceBoyle = makeDxtrTrustee({
    fullName: 'Terrence Boyle',
    firstName: 'Terrence',
    lastName: 'Boyle',
    legacy: {
      cityStateZipCountry: 'Fictionburg, NY 10999',
      phone: '2125550100',
    },
  });

  test('resolves the sole exact-name candidate when its phone differs by only 1-2 digits', async () => {
    const state = createInitialState(acmsTerrenceBoyle);
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'terrence-j-boyle',
          firstName: 'Terrence',
          middleName: 'J.',
          lastName: 'Boyle',
          name: 'Terrence J. Boyle',
          public: {
            address: {
              address1: '1 Fictional Way',
              city: 'Fictionburg',
              state: 'NY',
              zipCode: '10999',
              countryCode: 'US',
            },
            phone: { number: '212-555-0108' },
          },
        }),
      ),
    );
    addScore(candidate, 'calculateNameScore', { nameScore: 100, match: true });

    const result = await phoneTypoToleranceStage()(state);

    expect(result.match).toEqual({
      trusteeId: 'terrence-j-boyle',
      score: expect.objectContaining({ nameScore: 100, phoneDigitDistance: expect.any(Number) }),
    });
  });

  test.each([
    {
      description: "sole candidate's phone is genuinely a different number (large digit distance)",
      nameScore: 100,
      phone: '425-894-9945',
    },
    {
      description: 'nameScore is 85, not a perfect 100',
      nameScore: 85,
      phone: '212-573-0640',
    },
    {
      description: 'candidate phone is not comparable (fewer than 10 digits)',
      nameScore: 100,
      phone: '5550640',
    },
  ])('does not resolve when $description', async ({ nameScore, phone }) => {
    const state = createInitialState(acmsTerrenceBoyle);
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'terrence-j-boyle',
          name: 'Marisol B. Quade',
          public: {
            address: {
              address1: '825 Third Avenue, 26th Floor',
              city: 'New York',
              state: 'NY',
              zipCode: '10022',
              countryCode: 'US',
            },
            phone: { number: phone },
          },
        }),
      ),
    );
    addScore(candidate, 'calculateNameScore', { nameScore, match: true });

    const result = await phoneTypoToleranceStage()(state);

    expect(result.match).toBeNull();
  });

  test("does not resolve when more than one candidate qualifies - not this stage's job", async () => {
    const state = createInitialState(acmsTerrenceBoyle);
    const first = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'candidate-1',
          name: 'Marisol Quade',
          public: {
            address: {
              address1: '825 Third Avenue, 26th Floor',
              city: 'New York',
              state: 'NY',
              zipCode: '10022',
              countryCode: 'US',
            },
            phone: { number: '212-573-0640' },
          },
        }),
      ),
    );
    addScore(first, 'calculateNameScore', { nameScore: 100, match: true });
    const second = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'candidate-2',
          name: 'Marisol R. Quade',
          public: {
            address: {
              address1: '825 Third Avenue, 26th Floor',
              city: 'New York',
              state: 'NY',
              zipCode: '10022',
              countryCode: 'US',
            },
            phone: { number: '212-573-0641' },
          },
        }),
      ),
    );
    addScore(second, 'calculateNameScore', { nameScore: 100, match: true });

    const result = await phoneTypoToleranceStage()(state);

    expect(result.match).toBeNull();
  });

  test('no-ops once the pipeline has already matched', async () => {
    const state: PipelineState = {
      ...createInitialState(acmsTerrenceBoyle),
      match: { trusteeId: 'already-matched', score: {} },
    };
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'terrence-j-boyle',
          name: 'Marisol B. Quade',
          public: {
            address: {
              address1: '825 Third Avenue, 26th Floor',
              city: 'New York',
              state: 'NY',
              zipCode: '10022',
              countryCode: 'US',
            },
            phone: { number: '212-573-0640' },
          },
        }),
      ),
    );
    addScore(candidate, 'calculateNameScore', { nameScore: 100, match: true });

    await phoneTypoToleranceStage()(state);

    expect(candidate.scores).not.toHaveProperty('phoneTypoToleranceScore');
  });
});
