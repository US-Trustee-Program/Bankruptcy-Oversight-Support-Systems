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
  stateMatchCorroborationStage,
  noContactDataFilterStage,
  cityMatchStage,
  zipMatchStage,
  corroborationStage,
  comparativeCorroborationStage,
  phoneTypoToleranceStage,
  soleCandidateConsensusStage,
  firstNameFuzzyMatchStage,
  lastNameOnlyConsensusStage,
} from './trustee-match-pipeline-stages';

const makeDxtrTrustee = (overrides: Partial<DxtrTrusteeParty> = {}): DxtrTrusteeParty => ({
  fullName: 'John Doe',
  firstName: 'John',
  lastName: 'Doe',
  ...overrides,
});

const makeTrustee = (overrides: Partial<Trustee> = {}): Trustee =>
  MockData.getTrustee({ firstName: 'John', lastName: 'Doe', ...overrides });

/** Shared "Someone Moon" candidate fixture used across stateFilterStage/cityMatchStage/
 * zipMatchStage's describe blocks - a generic, deliberately-unrelated-to-the-ACMS-record surname
 * collision, not a specific name under test. */
const addSomeoneMoon = (state: PipelineState, overrides: Partial<Trustee> = {}) =>
  addCandidate(
    state,
    projectTrustee(
      makeTrustee({ firstName: 'Someone', lastName: 'Moon', name: 'Someone Moon', ...overrides }),
    ),
  );

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
    addScore(existingCandidate, 'calculateNameScore', { value: 42, threshold: 85, pass: false });

    const result = await surnameExactDiscoveryStage(context)(state);

    expect(result.candidates.get('t1')!.scores).toEqual({
      calculateNameScore: { value: 42, threshold: 85, pass: false },
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
      calculateNameScore: { value: 100, pass: true },
    });
    expect(mergedScore(result.candidates.get('t2')!)).toMatchObject({
      calculateNameScore: { value: 0, pass: false },
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
    addScore(candidate, 'stateFilterStage', { value: 100, threshold: 100, pass: true });

    const result = await nameScoreStage()(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
      stateFilterStage: { value: 100, pass: true },
      calculateNameScore: { value: 100, pass: true },
    });
  });

  test.each([
    {
      description: 'a bare middle initial disagrees with the other side (neutral, not a conflict)',
      dxtrMiddle: 'T',
      camsMiddle: 'B',
    },
    {
      description: "a bare middle initial doesn't match the other side's leading character",
      dxtrMiddle: 'T',
      camsMiddle: 'Bruce',
    },
  ])(
    'treats $description as full nameScore, not a 15-point penalty',
    async ({ dxtrMiddle, camsMiddle }) => {
      const state = createInitialState(
        makeDxtrTrustee({ firstName: 'John', middleName: dxtrMiddle, lastName: 'Doe' }),
      );
      addCandidate(
        state,
        projectTrustee(
          makeTrustee({
            trusteeId: 't1',
            firstName: 'John',
            middleName: camsMiddle,
            lastName: 'Doe',
          }),
        ),
      );

      const result = await nameScoreStage()(state);

      expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
        calculateNameScore: { value: 100, pass: true },
      });
    },
  );

  test('scores two full middle names that are a plausible spelling variant as 85, not a flat 15', async () => {
    const state = createInitialState(
      makeDxtrTrustee({ firstName: 'Richard', middleName: 'Jeffery', lastName: 'MacLeod' }),
    );
    addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 't1',
          firstName: 'Richard',
          middleName: 'Jeffrey',
          lastName: 'MacLeod',
        }),
      ),
    );

    const result = await nameScoreStage()(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
      calculateNameScore: { value: 85, pass: true },
    });
  });

  test('scores two full middle names that are NOT a plausible variant as a 15-point conflict, capping nameScore', async () => {
    const state = createInitialState(
      makeDxtrTrustee({ firstName: 'John', middleName: 'Alexander', lastName: 'Doe' }),
    );
    addCandidate(
      state,
      projectTrustee(
        makeTrustee({ trusteeId: 't1', firstName: 'John', middleName: 'Robert', lastName: 'Doe' }),
      ),
    );

    const result = await nameScoreStage()(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
      calculateNameScore: { value: 15, pass: false },
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

  test('annotates a state-mismatched candidate even in a small pool - runs regardless of pool size', async () => {
    const state = createInitialState(dxtrInWashington);
    addSomeoneMoon(state, {
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
      stateFilterStage: { pass: false },
    });
  });

  test('annotates a state-mismatched candidate in a large pool too', async () => {
    const state = createInitialState(dxtrInWashington);
    addSomeoneMoon(state, {
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
      addSomeoneMoon(state, {
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
      stateFilterStage: { pass: true },
    });
    expect(mergedScore(result.candidates.get('trustee-fl-0')!)).toMatchObject({
      stateFilterStage: { pass: false },
    });
  });

  test('does NOT mark a state-mismatched candidate as mismatched when it has an exact phone match', async () => {
    const state = createInitialState({
      ...dxtrInWashington,
      legacy: { ...dxtrInWashington.legacy, phone: '2065551212' },
    });
    addSomeoneMoon(state, {
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
      addSomeoneMoon(state, {
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
      stateFilterStage: { pass: true },
    });
  });

  test('does NOT mark a state-mismatched candidate as mismatched when its nameScore would be >= 85', async () => {
    const state = createInitialState(dxtrInWashington);
    addSomeoneMoon(state, {
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
      addSomeoneMoon(state, {
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
      stateFilterStage: { pass: true },
    });
  });

  test('does not mark anything mismatched when the ACMS address has no parseable state', async () => {
    const state = createInitialState({
      ...dxtrInWashington,
      legacy: { cityStateZipCountry: undefined },
    });
    for (let i = 0; i < 6; i++) {
      addSomeoneMoon(state, {
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
      expect(mergedScore(candidate)).toMatchObject({ stateFilterStage: { pass: true } });
    }
  });

  test('does not mark a candidate with no CAMS state as mismatched', async () => {
    const state = createInitialState(dxtrInWashington);
    addSomeoneMoon(state, {
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
      addSomeoneMoon(state, {
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
      stateFilterStage: { pass: true },
    });
  });

  test('no-ops once the pipeline has already matched', async () => {
    const state: PipelineState = {
      ...createInitialState(dxtrInWashington),
      match: { trusteeId: 'already-matched', score: {} },
    };
    addSomeoneMoon(state, { trusteeId: 't1' });

    const result = await stateFilterStage()(state);

    expect(result.candidates.get('t1')!.scores).toEqual({});
  });
});

describe('noContactDataFilterStage', () => {
  test('fails a candidate with NO address1, city, state, zip, or phone at all', async () => {
    const state = createInitialState(makeDxtrTrustee());
    addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: { address1: '', city: '', state: '', zipCode: '', countryCode: 'US' },
      },
    });

    const result = await noContactDataFilterStage()(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
      noContactDataFilterStage: { pass: false },
    });
  });

  test.each([
    {
      description: 'only a city populated',
      address: {
        address1: '',
        city: 'Seattle',
        state: '',
        zipCode: '',
        countryCode: 'US' as const,
      },
    },
    {
      description: 'only a state populated',
      address: { address1: '', city: '', state: 'WA', zipCode: '', countryCode: 'US' as const },
    },
    {
      description: 'only a zip populated',
      address: {
        address1: '',
        city: '',
        state: '',
        zipCode: '98101',
        countryCode: 'US' as const,
      },
    },
    {
      description: 'only address1 populated',
      address: {
        address1: '1 Elm St',
        city: '',
        state: '',
        zipCode: '',
        countryCode: 'US' as const,
      },
    },
  ])('passes a candidate with $description, even with nothing else', async ({ address }) => {
    const state = createInitialState(makeDxtrTrustee());
    addSomeoneMoon(state, { trusteeId: 't1', public: { address } });

    const result = await noContactDataFilterStage()(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
      noContactDataFilterStage: { pass: true },
    });
  });

  test('passes a candidate with no address at all but a phone on file', async () => {
    const state = createInitialState(makeDxtrTrustee());
    addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: { address1: '', city: '', state: '', zipCode: '', countryCode: 'US' },
        phone: { number: '206-555-0100' },
      },
    });

    const result = await noContactDataFilterStage()(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
      noContactDataFilterStage: { pass: true },
    });
  });

  test('no-ops once the pipeline has already matched', async () => {
    const state: PipelineState = {
      ...createInitialState(makeDxtrTrustee()),
      match: { trusteeId: 'already-matched', score: {} },
    };
    addSomeoneMoon(state, { trusteeId: 't1' });

    const result = await noContactDataFilterStage()(state);

    expect(result.candidates.get('t1')!.scores).toEqual({});
  });
});

describe('stateMatchCorroborationStage', () => {
  const dxtrInWashington = makeDxtrTrustee({
    fullName: 'Aldric A Moon',
    legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
  });

  test('records a pass when the candidate state matches, case-insensitively', async () => {
    const state = createInitialState(dxtrInWashington);
    addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Seattle',
          state: 'wa',
          zipCode: '98101',
          countryCode: 'US',
        },
      },
    });

    const result = await stateMatchCorroborationStage()(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
      stateMatchCorroborationStage: { value: 100, threshold: 100, pass: true },
    });
  });

  test('records a fail when the candidate state differs', async () => {
    const state = createInitialState(dxtrInWashington);
    addSomeoneMoon(state, {
      trusteeId: 't1',
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

    const result = await stateMatchCorroborationStage()(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
      stateMatchCorroborationStage: { pass: false },
    });
  });

  test('adds no record when the ACMS address is unparseable', async () => {
    const state = createInitialState(makeDxtrTrustee({ legacy: { cityStateZipCountry: '' } }));
    addSomeoneMoon(state, {
      trusteeId: 't1',
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

    const result = await stateMatchCorroborationStage()(state);

    expect(result.candidates.get('t1')!.scores.stateMatchCorroborationStage).toBeUndefined();
  });

  test('adds no record when the candidate has no state on file', async () => {
    const state = createInitialState(dxtrInWashington);
    addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Seattle',
          state: '',
          zipCode: '',
          countryCode: 'US',
        },
      },
    });

    const result = await stateMatchCorroborationStage()(state);

    expect(result.candidates.get('t1')!.scores.stateMatchCorroborationStage).toBeUndefined();
  });

  test('no-ops once the pipeline has already matched', async () => {
    const state: PipelineState = {
      ...createInitialState(dxtrInWashington),
      match: { trusteeId: 'already-matched', score: {} },
    };
    addSomeoneMoon(state, { trusteeId: 't1' });

    const result = await stateMatchCorroborationStage()(state);

    expect(result.candidates.get('t1')!.scores).toEqual({});
  });
});

describe('cityMatchStage', () => {
  const dxtrInSeattle = makeDxtrTrustee({
    fullName: 'Aldric A Moon',
    legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
  });

  test('records a pass when the candidate city matches, case-insensitively', async () => {
    const state = createInitialState(dxtrInSeattle);
    addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'SEATTLE',
          state: 'WA',
          zipCode: '98101',
          countryCode: 'US',
        },
      },
    });

    const result = await cityMatchStage()(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
      cityMatchStage: { value: 100, threshold: 100, pass: true },
    });
  });

  test('records a fail when the candidate city differs', async () => {
    const state = createInitialState(dxtrInSeattle);
    addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Tacoma',
          state: 'WA',
          zipCode: '98402',
          countryCode: 'US',
        },
      },
    });

    const result = await cityMatchStage()(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
      cityMatchStage: { pass: false },
    });
  });

  test('adds no record when the ACMS address is unparseable', async () => {
    const state = createInitialState(makeDxtrTrustee({ legacy: { cityStateZipCountry: '' } }));
    addSomeoneMoon(state, {
      trusteeId: 't1',
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

    const result = await cityMatchStage()(state);

    expect(result.candidates.get('t1')!.scores.cityMatchStage).toBeUndefined();
  });

  test('adds no record when the candidate has no city on file', async () => {
    const state = createInitialState(dxtrInSeattle);
    addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: { address1: '1 Elm St', city: '', state: 'WA', zipCode: '', countryCode: 'US' },
      },
    });

    const result = await cityMatchStage()(state);

    expect(result.candidates.get('t1')!.scores.cityMatchStage).toBeUndefined();
  });

  test('no-ops once the pipeline has already matched', async () => {
    const state: PipelineState = {
      ...createInitialState(dxtrInSeattle),
      match: { trusteeId: 'already-matched', score: {} },
    };
    addSomeoneMoon(state, { trusteeId: 't1' });

    const result = await cityMatchStage()(state);

    expect(result.candidates.get('t1')!.scores).toEqual({});
  });
});

describe('zipMatchStage', () => {
  const dxtrInSeattle = makeDxtrTrustee({
    fullName: 'Aldric A Moon',
    legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
  });

  test('records a pass when the 5-digit zip prefix matches, ignoring a +4 extension', async () => {
    const state = createInitialState(dxtrInSeattle);
    addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Seattle',
          state: 'WA',
          zipCode: '98101-4321',
          countryCode: 'US',
        },
      },
    });

    const result = await zipMatchStage()(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
      zipMatchStage: { value: 100, threshold: 100, pass: true },
    });
  });

  test('records a fail when the 5-digit zip prefix differs', async () => {
    const state = createInitialState(dxtrInSeattle);
    addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Tacoma',
          state: 'WA',
          zipCode: '98402',
          countryCode: 'US',
        },
      },
    });

    const result = await zipMatchStage()(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
      zipMatchStage: { pass: false },
    });
  });

  test('adds no record when the candidate has no zip on file', async () => {
    const state = createInitialState(dxtrInSeattle);
    addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: {
          address1: '1 Elm St',
          city: 'Seattle',
          state: 'WA',
          zipCode: '',
          countryCode: 'US',
        },
      },
    });

    const result = await zipMatchStage()(state);

    expect(result.candidates.get('t1')!.scores.zipMatchStage).toBeUndefined();
  });

  test('no-ops once the pipeline has already matched', async () => {
    const state: PipelineState = {
      ...createInitialState(dxtrInSeattle),
      match: { trusteeId: 'already-matched', score: {} },
    };
    addSomeoneMoon(state, { trusteeId: 't1' });

    const result = await zipMatchStage()(state);

    expect(result.candidates.get('t1')!.scores).toEqual({});
  });
});

describe('corroborationStage', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  test('sets state.match when resolveByContactCorroboration resolves with genuine corroboration', async () => {
    const state = createInitialState(makeDxtrTrustee());
    addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));
    vi.spyOn(trusteeMatchHelpers, 'resolveByContactCorroboration').mockResolvedValue({
      kind: 'resolved',
      trusteeId: 't1',
      candidateScores: [
        { trusteeId: 't1', nameScore: 100, addressScore: 0, phoneScore: 100 } as never,
      ],
    });

    const result = await corroborationStage(context)(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: { trusteeId: 't1', nameScore: 100, addressScore: 0, phoneScore: 100 },
    });
  });

  test('refuses a name-only resolution when the ACMS record has no real contact data to corroborate', async () => {
    const state = createInitialState(
      makeDxtrTrustee({ legacy: { phone: '0', fax: '0' } as never }),
    );
    addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));
    vi.spyOn(trusteeMatchHelpers, 'resolveByContactCorroboration').mockResolvedValue({
      kind: 'resolved',
      trusteeId: 't1',
      candidateScores: [
        { trusteeId: 't1', nameScore: 100, addressScore: 0, phoneScore: null } as never,
      ],
    });
    vi.spyOn(trusteeMatchHelpers, 'resolveDuplicateNameCandidates').mockResolvedValue({
      kind: 'unresolved',
      candidateScores: [],
    });

    const result = await corroborationStage(context)(state);

    expect(result.match).toBeNull();
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
    addScore(mismatched, 'stateFilterStage', { value: 0, threshold: 100, pass: false });
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
    addScore(bruceHalden, 'calculateNameScore', { value: 85, threshold: 85, pass: true });
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
    addScore(marcusFeld, 'calculateNameScore', { value: 85, threshold: 85, pass: true });

    const result = await comparativeCorroborationStage()(state);

    expect(result.match).toEqual({
      trusteeId: 'j-marcus-feld',
      score: expect.objectContaining({
        contactCorroborationPhone: expect.objectContaining({ value: 100, pass: true }),
      }),
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
    addScore(first, 'calculateNameScore', { value: 85, threshold: 85, pass: true });
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
    addScore(second, 'calculateNameScore', { value: 85, threshold: 85, pass: true });

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
    addScore(first, 'calculateNameScore', { value: 85, threshold: 85, pass: true });
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
    addScore(second, 'calculateNameScore', { value: 85, threshold: 85, pass: true });

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
    addScore(nameNoMatch, 'calculateNameScore', { value: 0, threshold: 85, pass: false });

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
    addScore(bruceHalden, 'calculateNameScore', { value: 85, threshold: 85, pass: true });
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
    addScore(marcusFeld, 'calculateNameScore', { value: 85, threshold: 85, pass: true });

    await comparativeCorroborationStage()(state);

    expect(mergedScore(bruceHalden)).toMatchObject({
      contactCorroborationPhone: { value: 0, pass: false },
    });
    expect(mergedScore(marcusFeld)).toMatchObject({
      contactCorroborationPhone: { value: 100, pass: true },
    });
  });

  test('no-ops once the pipeline has already matched', async () => {
    const state: PipelineState = {
      ...createInitialState(acmsMarcusFeld),
      match: { trusteeId: 'already-matched', score: {} },
    };
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));
    addScore(candidate, 'calculateNameScore', { value: 85, threshold: 85, pass: true });

    await comparativeCorroborationStage()(state);

    expect(candidate.scores).not.toHaveProperty('contactCorroborationAddress');
    expect(candidate.scores).not.toHaveProperty('contactCorroborationPhone');
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
    addScore(candidate, 'calculateNameScore', { value: 100, threshold: 85, pass: true });

    const result = await phoneTypoToleranceStage()(state);

    expect(result.match).toEqual({
      trusteeId: 'terrence-j-boyle',
      score: expect.objectContaining({
        phoneTypoToleranceScore: expect.objectContaining({
          phoneDigitDistance: expect.any(Number),
        }),
      }),
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
    addScore(candidate, 'calculateNameScore', { value: nameScore, threshold: 85, pass: true });

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
    addScore(first, 'calculateNameScore', { value: 100, threshold: 85, pass: true });
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
    addScore(second, 'calculateNameScore', { value: 100, threshold: 85, pass: true });

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
    addScore(candidate, 'calculateNameScore', { value: 100, threshold: 85, pass: true });

    await phoneTypoToleranceStage()(state);

    expect(candidate.scores).not.toHaveProperty('phoneTypoToleranceScore');
  });
});

describe('soleCandidateConsensusStage', () => {
  const acmsRecord = makeDxtrTrustee({ fullName: 'Aldric A Moon' });

  test('resolves a sole nameScore=85 candidate when every corroborating vote passes', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
    );
    addScore(candidate, 'calculateNameScore', { value: 85, threshold: 85, pass: true });
    addScore(candidate, 'stateFilterStage', { value: 100, threshold: 100, pass: true });
    addScore(candidate, 'cityMatchStage', { value: 100, threshold: 100, pass: true });
    addScore(candidate, 'zipMatchStage', { value: 100, threshold: 100, pass: true });

    const result = await soleCandidateConsensusStage()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: expect.objectContaining({
        soleCandidateConsensusStage: expect.objectContaining({ pass: true }),
      }),
    });
  });

  test('does not resolve when most votes fail', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
    );
    addScore(candidate, 'calculateNameScore', { value: 85, threshold: 85, pass: true });
    addScore(candidate, 'stateFilterStage', { value: 100, threshold: 100, pass: true });
    addScore(candidate, 'cityMatchStage', { value: 0, threshold: 100, pass: false });
    addScore(candidate, 'contactCorroborationAddress', { value: 3, threshold: 80, pass: false });

    const result = await soleCandidateConsensusStage()(state);

    expect(result.match).toBeNull();
    expect(mergedScore(candidate)).toMatchObject({
      soleCandidateConsensusStage: { pass: false },
    });
  });

  test('does not resolve when no corroborating scorer ran at all', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
    );
    addScore(candidate, 'calculateNameScore', { value: 85, threshold: 85, pass: true });

    const result = await soleCandidateConsensusStage()(state);

    expect(result.match).toBeNull();
    expect(candidate.scores.soleCandidateConsensusStage).toBeUndefined();
  });

  test('does not resolve when the candidate never cleared the name threshold', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Else' })),
    );
    addScore(candidate, 'calculateNameScore', { value: 0, threshold: 85, pass: false });
    addScore(candidate, 'stateFilterStage', { value: 100, threshold: 100, pass: true });

    const result = await soleCandidateConsensusStage()(state);

    expect(result.match).toBeNull();
  });

  test("does not resolve when more than one candidate qualifies - not this stage's job", async () => {
    const state = createInitialState(acmsRecord);
    const first = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
    );
    addScore(first, 'calculateNameScore', { value: 85, threshold: 85, pass: true });
    addScore(first, 'stateFilterStage', { value: 100, threshold: 100, pass: true });
    const second = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't2', name: 'Someone Else Moon' })),
    );
    addScore(second, 'calculateNameScore', { value: 85, threshold: 85, pass: true });
    addScore(second, 'stateFilterStage', { value: 100, threshold: 100, pass: true });

    const result = await soleCandidateConsensusStage()(state);

    expect(result.match).toBeNull();
  });

  test('no-ops once the pipeline has already matched', async () => {
    const state: PipelineState = {
      ...createInitialState(acmsRecord),
      match: { trusteeId: 'already-matched', score: {} },
    };
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
    );
    addScore(candidate, 'calculateNameScore', { value: 85, threshold: 85, pass: true });
    addScore(candidate, 'stateFilterStage', { value: 100, threshold: 100, pass: true });

    const result = await soleCandidateConsensusStage()(state);

    expect(result.match).toEqual({ trusteeId: 'already-matched', score: {} });
  });
});

describe('firstNameFuzzyMatchStage', () => {
  const acmsGeoffGroshong = makeDxtrTrustee({
    fullName: 'Geoff Groshong',
    firstName: 'Geoff',
    lastName: 'Groshong',
  });

  test('records a pass for a sole exact-lastName candidate with a plausible nickname first name', async () => {
    const state = createInitialState(acmsGeoffGroshong);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Geoffrey', lastName: 'Groshong' })),
    );
    addScore(candidate, 'calculateNameScore', { value: 0, threshold: 85, pass: false });

    const result = await firstNameFuzzyMatchStage()(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
      firstNameFuzzyMatchStage: { pass: true },
    });
  });

  test('records a fail for a sole exact-lastName candidate whose first name is not plausibly related', async () => {
    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'Harry Campbell', firstName: 'Harry', lastName: 'Campbell' }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Kevin', lastName: 'Campbell' })),
    );
    addScore(candidate, 'calculateNameScore', { value: 0, threshold: 85, pass: false });

    const result = await firstNameFuzzyMatchStage()(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
      firstNameFuzzyMatchStage: { pass: false },
    });
  });

  test('does not run when the candidate lastName differs', async () => {
    const state = createInitialState(acmsGeoffGroshong);
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({ trusteeId: 't1', firstName: 'Geoffrey', lastName: 'Someone Else' }),
      ),
    );
    addScore(candidate, 'calculateNameScore', { value: 0, threshold: 85, pass: false });

    const result = await firstNameFuzzyMatchStage()(state);

    expect(result.candidates.get('t1')!.scores.firstNameFuzzyMatchStage).toBeUndefined();
  });

  test('does not run when nameScore is nonzero (a genuinely ambiguous or partial match, not this pattern)', async () => {
    const state = createInitialState(acmsGeoffGroshong);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Geoffrey', lastName: 'Groshong' })),
    );
    addScore(candidate, 'calculateNameScore', { value: 85, threshold: 85, pass: true });

    const result = await firstNameFuzzyMatchStage()(state);

    expect(result.candidates.get('t1')!.scores.firstNameFuzzyMatchStage).toBeUndefined();
  });

  test('does not run when more than one sole-lastName candidate qualifies', async () => {
    const state = createInitialState(acmsGeoffGroshong);
    const first = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Geoffrey', lastName: 'Groshong' })),
    );
    addScore(first, 'calculateNameScore', { value: 0, threshold: 85, pass: false });
    const second = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't2', firstName: 'Jeff', lastName: 'Groshong' })),
    );
    addScore(second, 'calculateNameScore', { value: 0, threshold: 85, pass: false });

    const result = await firstNameFuzzyMatchStage()(state);

    expect(result.candidates.get('t1')!.scores.firstNameFuzzyMatchStage).toBeUndefined();
    expect(result.candidates.get('t2')!.scores.firstNameFuzzyMatchStage).toBeUndefined();
  });

  test('no-ops once the pipeline has already matched', async () => {
    const state: PipelineState = {
      ...createInitialState(acmsGeoffGroshong),
      match: { trusteeId: 'already-matched', score: {} },
    };
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Geoffrey', lastName: 'Groshong' })),
    );
    addScore(candidate, 'calculateNameScore', { value: 0, threshold: 85, pass: false });

    const result = await firstNameFuzzyMatchStage()(state);

    expect(result.candidates.get('t1')!.scores).toEqual({
      calculateNameScore: { value: 0, threshold: 85, pass: false },
    });
  });
});

describe('lastNameOnlyConsensusStage', () => {
  const acmsGeoffGroshong = makeDxtrTrustee({
    fullName: 'Geoff Groshong',
    firstName: 'Geoff',
    lastName: 'Groshong',
  });

  test('resolves when the fuzzy-name vote and other corroboration together clear the consensus bar', async () => {
    const state = createInitialState(acmsGeoffGroshong);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Geoffrey', lastName: 'Groshong' })),
    );
    addScore(candidate, 'calculateNameScore', { value: 0, threshold: 85, pass: false });
    addScore(candidate, 'firstNameFuzzyMatchStage', { value: 93, threshold: 80, pass: true });
    addScore(candidate, 'stateFilterStage', { value: 100, threshold: 100, pass: true });
    addScore(candidate, 'cityMatchStage', { value: 100, threshold: 100, pass: true });

    const result = await lastNameOnlyConsensusStage()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: expect.objectContaining({
        lastNameOnlyConsensusStage: expect.objectContaining({ pass: true }),
      }),
    });
  });

  test('does not resolve when most votes (including the fuzzy-name vote) fail', async () => {
    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'Harry Campbell', firstName: 'Harry', lastName: 'Campbell' }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Kevin', lastName: 'Campbell' })),
    );
    addScore(candidate, 'calculateNameScore', { value: 0, threshold: 85, pass: false });
    addScore(candidate, 'firstNameFuzzyMatchStage', { value: 0, threshold: 80, pass: false });
    addScore(candidate, 'stateFilterStage', { value: 100, threshold: 100, pass: true });
    addScore(candidate, 'cityMatchStage', { value: 0, threshold: 100, pass: false });
    addScore(candidate, 'zipMatchStage', { value: 0, threshold: 100, pass: false });

    const result = await lastNameOnlyConsensusStage()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when no candidate has a firstNameFuzzyMatchStage record at all', async () => {
    const state = createInitialState(acmsGeoffGroshong);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Geoffrey', lastName: 'Groshong' })),
    );
    addScore(candidate, 'calculateNameScore', { value: 0, threshold: 85, pass: false });

    const result = await lastNameOnlyConsensusStage()(state);

    expect(result.match).toBeNull();
  });

  test('no-ops once the pipeline has already matched', async () => {
    const state: PipelineState = {
      ...createInitialState(acmsGeoffGroshong),
      match: { trusteeId: 'already-matched', score: {} },
    };
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Geoffrey', lastName: 'Groshong' })),
    );
    addScore(candidate, 'firstNameFuzzyMatchStage', { value: 93, threshold: 80, pass: true });

    const result = await lastNameOnlyConsensusStage()(state);

    expect(result.match).toEqual({ trusteeId: 'already-matched', score: {} });
  });
});
