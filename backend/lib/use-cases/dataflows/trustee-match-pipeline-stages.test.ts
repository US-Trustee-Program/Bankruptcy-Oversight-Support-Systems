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
  createTrusteeInitialState as createInitialState,
  mergedScore,
  TrusteePipelineCandidate as PipelineCandidate,
  TrusteePipelineState as PipelineState,
  projectTrustee,
} from './trustee-match-pipeline';
import * as trusteeMatchHelpers from './trustee-match.helpers';
import {
  recallBySurnameExact,
  recallByNameThenResolveExact,
  recallByTokenIntersection,
  recallByAnchoredLevenshtein,
  resolveBySoleContactMatch,
  resolveByComparativeCorroboration,
  resolveByPhoneTypoTolerance,
  resolveBySoleExactNameMatch,
  resolveBySoleExactNameMatchByStateThenGeo,
  resolveBySoleExactNameMatchNoAcmsData,
  scoreAddressDisqualifiers,
  scoreNameDisqualifiers,
  resolveBySoleFuzzyFirstNameMatchAfterAddressNarrowing,
  resolveBySoleFuzzyFirstNameMatchNoAcmsData,
  resolveRisky,
  resolveByConsensus,
  resolveBySoleFuzzyNameMatchAndState,
  resolveByLastNameOnlyConsensus,
  resolveByFuzzyLastNameMatch,
  normalizeAcmsSourceName,
  skipAdministrativePlaceholder,
  scoreCandidate,
  addAndScoreCandidate,
} from './trustee-match-pipeline-stages';

const makeDxtrTrustee = (overrides: Partial<DxtrTrusteeParty> = {}): DxtrTrusteeParty => ({
  fullName: 'John Doe',
  firstName: 'John',
  lastName: 'Doe',
  ...overrides,
});

const makeTrustee = (overrides: Partial<Trustee> = {}): Trustee =>
  MockData.getTrustee({ firstName: 'John', lastName: 'Doe', ...overrides });

/** Shared "Someone Moon" candidate fixture used across isStateNotConflicting/doesCityMatch/
 * doesZipCodeMatch's describe blocks - a generic, deliberately-unrelated-to-the-ACMS-record surname
 * collision, not a specific name under test. */
const addSomeoneMoon = (state: PipelineState, overrides: Partial<Trustee> = {}) =>
  addCandidate(
    state,
    projectTrustee(
      makeTrustee({ firstName: 'Someone', lastName: 'Moon', name: 'Someone Moon', ...overrides }),
    ),
  );

describe('skipAdministrativePlaceholder', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Real shape from a CAMS-879 backtest (see shouldSkipAsNotAPerson's own test coverage in
  // sync-acms-professional-ids.test.ts) - an ACMS record naming no real person at all, only
  // administrative placeholder text.
  test('sets state.skip when the record trips shouldSkipAsNotAPerson', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(makeDxtrTrustee({ firstName: '', lastName: 'NOT ASSIGNED' })),
    );

    const result = await skipAdministrativePlaceholder()(state);

    expect(result.skip).toBe(true);
  });

  // Real shape from the same backtest: an administrative marker attached to an otherwise-real
  // name ("JULES COHEN/DO NOT USE") is NOT skip-worthy - shouldSkipAsNotAPerson strips the marker
  // and finds a real person underneath, so this stage must leave state unchanged. Runs
  // normalizeAcmsSourceName first, matching real pipeline stage ordering (see
  // skipAdministrativePlaceholder's own doc comment: it reads state.sourceNormalized, which only
  // normalizeAcmsSourceName populates).
  test('leaves state unchanged for a real-looking name', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(makeDxtrTrustee({ firstName: 'JULES', lastName: 'COHEN/DO NOT USE' })),
    );

    const result = await skipAdministrativePlaceholder()(state);

    expect(result.skip).toBe(false);
  });
});

describe('recallBySurnameExact', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  // Runs normalizeAcmsSourceName first, matching real pipeline stage ordering -
  // recallBySurnameExact reads state.sourceNormalized directly (already lowercase/
  // firstLastNameToken-reduced), not state.sourceRaw's original casing.
  test('adds every surname-exact candidate found to the pipeline state', async () => {
    const jordanVoss = makeTrustee({
      trusteeId: 't1',
      firstName: 'Jordan',
      lastName: 'Voss',
      name: 'Jordan P. Voss',
    });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockResolvedValue([jordanVoss]);

    const state = await normalizeAcmsSourceName()(
      createInitialState(makeDxtrTrustee({ fullName: 'Aldric T Voss', lastName: 'Voss' })),
    );

    const result = await recallBySurnameExact(context)(state);

    expect(result.candidates.has('t1')).toBe(true);
    expect(result.candidates.get('t1')!.camsRaw.name).toBe('Jordan P. Voss');
  });

  test('does not reset an existing candidate already discovered by a prior stage', async () => {
    const jordanVoss = makeTrustee({ trusteeId: 't1', name: 'Jordan P. Voss' });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockResolvedValue([jordanVoss]);

    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'Aldric T Voss', lastName: 'Voss' }),
    );
    const existingCandidate = addCandidate(state, projectTrustee(jordanVoss));
    addScore(existingCandidate, 'doesNameMatch', { value: 42, threshold: 85, pass: false });

    const result = await recallBySurnameExact(context)(state);

    expect(result.candidates.get('t1')!.scores).toEqual({
      doesNameMatch: { value: 42, threshold: 85, pass: false },
    });
  });

  test('records a gateway failure on state.error as a CamsError with a stack trace, rather than throwing', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockRejectedValue(
      new Error('Mongo timeout'),
    );

    const state = createInitialState(makeDxtrTrustee());

    const result = await recallBySurnameExact(context)(state);

    expect(result.error).toMatchObject({
      isCamsError: true,
      camsStack: [{ message: 'recallBySurnameExact failed' }],
    });
    expect(result.match).toBeNull();
  });
});

describe('recallByNameThenResolveExact', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  test('resolves state.match directly when matchTrusteeByName resolves an exact unique match', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
      kind: 'resolved',
      trusteeId: 't1',
      nameScore: 100,
      nameMatchQuality: 'exact',
    });

    const state = createInitialState(makeDxtrTrustee());

    const result = await recallByNameThenResolveExact(context)(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: { nameScore: 100, nameMatchQuality: 'exact' },
    });
    expect(result.candidates.size).toBe(0);
  });

  test('adds every candidate from an ambiguous result to the pipeline state, without resolving', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
      kind: 'ambiguous',
      matchCandidates: [{ trusteeId: 't1' } as never, { trusteeId: 't2' } as never],
    });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds').mockResolvedValue([
      makeTrustee({ trusteeId: 't1', name: 'Someone Moon' }),
      makeTrustee({ trusteeId: 't2', name: 'Someone Else' }),
    ]);

    const state = createInitialState(makeDxtrTrustee());

    const result = await recallByNameThenResolveExact(context)(state);

    expect(result.match).toBeNull();
    expect(result.candidates.has('t1')).toBe(true);
    expect(result.candidates.has('t2')).toBe(true);
  });

  test('adds nothing when matchTrusteeByName returns no-match', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({ kind: 'no-match' });
    const findByIdsSpy = vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds');

    const state = createInitialState(makeDxtrTrustee());

    const result = await recallByNameThenResolveExact(context)(state);

    expect(result.match).toBeNull();
    expect(result.candidates.size).toBe(0);
    expect(findByIdsSpy).not.toHaveBeenCalled();
  });

  test('records a matchTrusteeByName failure on state.error, rather than throwing', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockRejectedValue(
      new Error('Mongo timeout'),
    );

    const state = createInitialState(makeDxtrTrustee());

    const result = await recallByNameThenResolveExact(context)(state);

    expect(result.error).toMatchObject({
      isCamsError: true,
      camsStack: [{ message: 'recallByNameThenResolveExact failed' }],
    });
    expect(result.match).toBeNull();
  });

  test('records a findTrusteesByIds failure (ambiguous refetch) on state.error, rather than throwing', async () => {
    vi.spyOn(trusteeMatchHelpers, 'matchTrusteeByName').mockResolvedValue({
      kind: 'ambiguous',
      matchCandidates: [{ trusteeId: 't1' } as never],
    });
    vi.spyOn(MockMongoRepository.prototype, 'findTrusteesByIds').mockRejectedValue(
      new Error('Mongo timeout'),
    );

    const state = createInitialState(makeDxtrTrustee());

    const result = await recallByNameThenResolveExact(context)(state);

    expect(result.error).toMatchObject({
      isCamsError: true,
      camsStack: [
        { message: 'recallByNameThenResolveExact failed refetching ambiguous candidates' },
      ],
    });
    expect(result.match).toBeNull();
  });
});

describe('recallByTokenIntersection', () => {
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

    const result = await recallByTokenIntersection(context)(state);

    expect(result.candidates.has('t1')).toBe(true);
  });

  // Real evidence, not discarded (see cams-6djma): a candidate surviving intersection matched
  // EVERY ACMS token searched, which this stage records at the moment of discovery.
  test('records the number of ACMS tokens intersected as a SCORE on every candidate found', async () => {
    const cray = makeTrustee({ trusteeId: 't1', name: 'Desmond Wheeler Cray' });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockImplementation(
      async (token: string) => (token === 'wheeler' || token === 'cray' ? [cray] : []),
    );

    const state = createInitialState(makeDxtrTrustee({ fullName: 'D. Wheeler Cray' }));

    const result = await recallByTokenIntersection(context)(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
      recallByTokenIntersection: { value: 2, threshold: 2, pass: true },
    });
  });

  test('does not search at all for a single-token ACMS name (nothing to intersect)', async () => {
    const searchSpy = vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName');
    const state = createInitialState(makeDxtrTrustee({ fullName: 'Cray' }));

    await recallByTokenIntersection(context)(state);

    expect(searchSpy).not.toHaveBeenCalled();
  });

  test('records a gateway failure on state.error, rather than throwing', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockRejectedValue(
      new Error('Mongo timeout'),
    );

    const state = createInitialState(makeDxtrTrustee({ fullName: 'D. Wheeler Cray' }));

    const result = await recallByTokenIntersection(context)(state);

    expect(result.error).toMatchObject({
      isCamsError: true,
      camsStack: [{ message: 'recallByTokenIntersection failed' }],
    });
    expect(result.match).toBeNull();
  });
});

describe('recallByAnchoredLevenshtein', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  // Runs normalizeAcmsSourceName first, matching real pipeline stage ordering -
  // recallByAnchoredLevenshtein reads state.sourceNormalized directly (already
  // firstLastNameToken/normalizeNamePart-reduced), not state.sourceRaw.
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

    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ fullName: 'Norburt Falk', firstName: 'Norburt', lastName: 'Falk' }),
      ),
    );

    const result = await recallByAnchoredLevenshtein(context)(state);

    expect(result.candidates.has('t1')).toBe(true);
  });

  // Real evidence, not discarded (see cams-6djma): the edit distance IS the signal (a distance of
  // 1 is stronger evidence than 2), recorded at the moment of discovery.
  test('records the actual edit distance as a SCORE on every candidate found', async () => {
    const falk = makeTrustee({
      trusteeId: 't1',
      firstName: 'Norbert',
      lastName: 'Falk',
      name: 'Norbert Falk',
    });
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockImplementation(
      async (token: string) => (token === 'falk' ? [falk] : []),
    );

    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ fullName: 'Norburt Falk', firstName: 'Norburt', lastName: 'Falk' }),
      ),
    );

    const result = await recallByAnchoredLevenshtein(context)(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
      recallByAnchoredLevenshtein: { value: 1, threshold: 2, pass: true },
    });
  });

  test('records a gateway failure on state.error, rather than throwing', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'searchTrusteesByName').mockRejectedValue(
      new Error('Mongo timeout'),
    );

    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'Norburt Falk', firstName: 'Norburt', lastName: 'Falk' }),
    );

    const result = await recallByAnchoredLevenshtein(context)(state);

    expect(result.error).toMatchObject({
      isCamsError: true,
      camsStack: [{ message: 'recallByAnchoredLevenshtein failed' }],
    });
    expect(result.match).toBeNull();
  });
});

describe('scoreCandidate - name-match facet', () => {
  test('merges a nameScore and a match flag onto every candidate currently in the pipeline', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ fullName: 'John Doe', firstName: 'John', lastName: 'Doe' }),
      ),
    );
    const t1 = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'John', lastName: 'Doe' })),
    );
    const t2 = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't2', firstName: 'Someone', lastName: 'Else' })),
    );

    scoreCandidate(state.sourceNormalized, t1);
    scoreCandidate(state.sourceNormalized, t2);

    expect(mergedScore(t1)).toMatchObject({ doesNameMatch: { value: 100, pass: true } });
    expect(mergedScore(t2)).toMatchObject({ doesNameMatch: { value: 0, pass: false } });
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
      const state = await normalizeAcmsSourceName()(
        createInitialState(
          makeDxtrTrustee({ firstName: 'John', middleName: dxtrMiddle, lastName: 'Doe' }),
        ),
      );
      const candidate = addCandidate(
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

      scoreCandidate(state.sourceNormalized, candidate);

      expect(mergedScore(candidate)).toMatchObject({
        doesNameMatch: { value: 100, pass: true },
      });
    },
  );

  test('scores two full middle names that are a plausible spelling variant as 85, not a flat 15', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ firstName: 'Richard', middleName: 'Jeffery', lastName: 'MacLeod' }),
      ),
    );
    const candidate = addCandidate(
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

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      doesNameMatch: { value: 85, pass: true },
    });
  });

  test('scores two full middle names that are NOT a plausible variant as a 15-point conflict, capping nameScore', async () => {
    const state = await normalizeAcmsSourceName()(
      createInitialState(
        makeDxtrTrustee({ firstName: 'John', middleName: 'Alexander', lastName: 'Doe' }),
      ),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({ trusteeId: 't1', firstName: 'John', middleName: 'Robert', lastName: 'Doe' }),
      ),
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      doesNameMatch: { value: 15, pass: false },
    });
  });
});

describe('scoreCandidate - similarity-diagnostics facet', () => {
  test('records fullNameSimilarity and tokenNameMatchRate onto the candidate', async () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: 'John Doe' }));
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'John Doe' })),
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.memo.get('fullNameSimilarity')).toEqual([
      { key: 'john doe|john doe', value: 1 },
    ]);
    expect(candidate.memo.get('tokenNameMatchRate')).toEqual([
      { key: 'john doe|john doe', value: 1 },
    ]);
  });

  test('computes the ACMS-side normalized name once on sourceNormalized rather than recomputing it per candidate', async () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: 'John Doe' }));
    const t1 = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Jane Smith' })),
    );
    const t2 = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't2', name: 'Bob Jones' })),
    );

    scoreCandidate(state.sourceNormalized, t1);
    scoreCandidate(state.sourceNormalized, t2);

    expect(state.sourceNormalized.name).toBe('john doe');
  });

  test("computes each candidate's own normalized name once, reused by both fullNameSimilarity and tokenNameMatchRate", async () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: 'John Doe' }));
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: "O'Brien-Smith" })),
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.camsNormalized.name).toBe('obrien smith');
  });
});

describe('scoreCandidate - state/city/zip/contact-presence facets', () => {
  const dxtrInWashington = makeDxtrTrustee({
    fullName: 'Aldric T Moon',
    firstName: 'Aldric',
    middleName: 'A',
    lastName: 'Moon',
    legacy: { cityStateZipCountry: 'Tacoma, WA 98402' },
  });

  test('annotates a state-mismatched candidate as isStateNotConflicting:false', async () => {
    const state = createInitialState(dxtrInWashington);
    const candidate = addSomeoneMoon(state, {
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

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      isStateNotConflicting: { pass: false },
    });
  });

  test('does NOT mark a state-mismatched candidate as mismatched when it has an exact phone match', async () => {
    const state = createInitialState({
      ...dxtrInWashington,
      legacy: { ...dxtrInWashington.legacy, phone: '2065551212' },
    });
    const candidate = addSomeoneMoon(state, {
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

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      isStateNotConflicting: { pass: true },
    });
  });

  test('does NOT mark a state-mismatched candidate as mismatched when its nameScore would be >= 85', async () => {
    const state = createInitialState(dxtrInWashington);
    const candidate = addSomeoneMoon(state, {
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

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      isStateNotConflicting: { pass: true },
    });
  });

  test('does not mark anything mismatched when the ACMS address has no parseable state', async () => {
    const state = createInitialState({
      ...dxtrInWashington,
      legacy: { cityStateZipCountry: undefined },
    });
    const candidate = addSomeoneMoon(state, {
      trusteeId: 'trustee-1',
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

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({ isStateNotConflicting: { pass: true } });
  });

  test('does not mark a candidate with no CAMS state as mismatched', async () => {
    const state = createInitialState(dxtrInWashington);
    const candidate = addSomeoneMoon(state, {
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

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      isStateNotConflicting: { pass: true },
    });
  });

  test('fails doesCamsTrusteeHaveAddressAndPhone for a candidate with NO address1, city, state, zip, or phone at all', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: { address1: '', city: '', state: '', zipCode: '', countryCode: 'US' },
      },
    });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      doesCamsTrusteeHaveAddressAndPhone: { pass: false },
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
  ])(
    'passes doesCamsTrusteeHaveAddressAndPhone for a candidate with $description, even with nothing else',
    async ({ address }) => {
      const state = createInitialState(makeDxtrTrustee());
      const candidate = addSomeoneMoon(state, { trusteeId: 't1', public: { address } });

      scoreCandidate(state.sourceNormalized, candidate);

      expect(mergedScore(candidate)).toMatchObject({
        doesCamsTrusteeHaveAddressAndPhone: { pass: true },
      });
    },
  );

  test('passes doesCamsTrusteeHaveAddressAndPhone for a candidate with no address at all but a phone on file', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: { address1: '', city: '', state: '', zipCode: '', countryCode: 'US' },
        phone: { number: '206-555-0100' },
      },
    });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      doesCamsTrusteeHaveAddressAndPhone: { pass: true },
    });
  });

  test('fails doesAcmsTrusteeHaveAddressAndPhone when the ACMS record has no address1, cityStateZipCountry, phone, or email at all', async () => {
    const state = createInitialState(
      makeDxtrTrustee({ legacy: { address1: '', cityStateZipCountry: '', phone: '0', fax: '0' } }),
    );
    const candidate = addSomeoneMoon(state, { trusteeId: 't1' });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      doesAcmsTrusteeHaveAddressAndPhone: { pass: false },
    });
  });

  test.each([
    {
      description: 'address1 populated',
      legacy: { address1: '123 Main St', cityStateZipCountry: '', phone: '0', fax: '0' },
    },
    {
      description: 'cityStateZipCountry populated',
      legacy: { address1: '', cityStateZipCountry: 'Seattle WA 98101', phone: '0', fax: '0' },
    },
    {
      description: 'a real phone number populated',
      legacy: { address1: '', cityStateZipCountry: '', phone: '206-555-0100', fax: '0' },
    },
  ])(
    'passes doesAcmsTrusteeHaveAddressAndPhone when the ACMS record has $description',
    async ({ legacy }) => {
      const state = createInitialState(makeDxtrTrustee({ legacy }));
      const candidate = addSomeoneMoon(state, { trusteeId: 't1' });

      scoreCandidate(state.sourceNormalized, candidate);

      expect(mergedScore(candidate)).toMatchObject({
        doesAcmsTrusteeHaveAddressAndPhone: { pass: true },
      });
    },
  );

  test('treats ACMS phone/fax "0" as blank, not a real value for doesAcmsTrusteeHaveAddressAndPhone', async () => {
    const state = createInitialState(
      makeDxtrTrustee({ legacy: { address1: '', cityStateZipCountry: '', phone: '0', fax: '0' } }),
    );
    const candidate = addSomeoneMoon(state, { trusteeId: 't1' });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      doesAcmsTrusteeHaveAddressAndPhone: { pass: false },
    });
  });

  test('records a doesStateMatch pass when the candidate state matches, case-insensitively', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: 'Aldric A Moon',
        legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
      }),
    );
    const candidate = addSomeoneMoon(state, {
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

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      doesStateMatch: { value: 100, threshold: 100, pass: true },
    });
  });

  test('records a doesStateMatch fail when the candidate state differs', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: 'Aldric A Moon',
        legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
      }),
    );
    const candidate = addSomeoneMoon(state, {
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

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      doesStateMatch: { pass: false },
    });
  });

  test('adds no doesStateMatch record when the ACMS address is unparseable', async () => {
    const state = createInitialState(makeDxtrTrustee({ legacy: { cityStateZipCountry: '' } }));
    const candidate = addSomeoneMoon(state, {
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

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores.doesStateMatch).toBeUndefined();
  });

  test('adds no doesStateMatch record when the candidate has no state on file', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: 'Aldric A Moon',
        legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
      }),
    );
    const candidate = addSomeoneMoon(state, {
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

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores.doesStateMatch).toBeUndefined();
  });

  test('records a doesCityMatch pass when the candidate city matches, case-insensitively', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: 'Aldric A Moon',
        legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
      }),
    );
    const candidate = addSomeoneMoon(state, {
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

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      doesCityMatch: { value: 100, threshold: 100, pass: true },
    });
  });

  test('records a doesCityMatch fail when the candidate city differs', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: 'Aldric A Moon',
        legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
      }),
    );
    const candidate = addSomeoneMoon(state, {
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

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      doesCityMatch: { pass: false },
    });
  });

  test('adds no doesCityMatch record when the ACMS address is unparseable', async () => {
    const state = createInitialState(makeDxtrTrustee({ legacy: { cityStateZipCountry: '' } }));
    const candidate = addSomeoneMoon(state, {
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

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores.doesCityMatch).toBeUndefined();
  });

  test('adds no doesCityMatch record when the candidate has no city on file', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: 'Aldric A Moon',
        legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
      }),
    );
    const candidate = addSomeoneMoon(state, {
      trusteeId: 't1',
      public: {
        address: { address1: '1 Elm St', city: '', state: 'WA', zipCode: '', countryCode: 'US' },
      },
    });

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores.doesCityMatch).toBeUndefined();
  });

  test('records a doesZipCodeMatch pass when the 5-digit zip prefix matches, ignoring a +4 extension', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: 'Aldric A Moon',
        legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
      }),
    );
    const candidate = addSomeoneMoon(state, {
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

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      doesZipCodeMatch: { value: 100, threshold: 100, pass: true },
    });
  });

  test('records a doesZipCodeMatch fail when the 5-digit zip prefix differs', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: 'Aldric A Moon',
        legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
      }),
    );
    const candidate = addSomeoneMoon(state, {
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

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      doesZipCodeMatch: { pass: false },
    });
  });

  test('adds no doesZipCodeMatch record when the candidate has no zip on file', async () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: 'Aldric A Moon',
        legacy: { cityStateZipCountry: 'Seattle, WA 98101' },
      }),
    );
    const candidate = addSomeoneMoon(state, {
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

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores.doesZipCodeMatch).toBeUndefined();
  });
});

describe('scoreAddressDisqualifiers', () => {
  test('records ONE combined disqualifier when city, state, AND zip all actively disagree', () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: 'Aldric A Moon' }));
    const candidate = addSomeoneMoon(state, { trusteeId: 't1' });
    addScore(candidate, 'doesCityMatch', { value: 0, threshold: 100, pass: false });
    addScore(candidate, 'doesStateMatch', { value: 0, threshold: 100, pass: false });
    addScore(candidate, 'doesZipCodeMatch', { value: 0, threshold: 100, pass: false });

    scoreAddressDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([
      expect.objectContaining({ scorer: 'addressDisqualifiers' }),
    ]);
  });

  test.each([
    ['only city disagrees', { doesCityMatch: false, doesStateMatch: true, doesZipCodeMatch: true }],
    [
      'only state disagrees',
      { doesCityMatch: true, doesStateMatch: false, doesZipCodeMatch: true },
    ],
    ['only zip disagrees', { doesCityMatch: true, doesStateMatch: true, doesZipCodeMatch: false }],
    [
      'city and state disagree but zip agrees',
      { doesCityMatch: false, doesStateMatch: false, doesZipCodeMatch: true },
    ],
  ])('does not disqualify on a partial disagreement (%s) - too weak a signal', (_desc, passes) => {
    const state = createInitialState(makeDxtrTrustee({ fullName: 'Aldric A Moon' }));
    const candidate = addSomeoneMoon(state, { trusteeId: 't1' });
    addScore(candidate, 'doesCityMatch', { value: 0, threshold: 100, pass: passes.doesCityMatch });
    addScore(candidate, 'doesStateMatch', {
      value: 0,
      threshold: 100,
      pass: passes.doesStateMatch,
    });
    addScore(candidate, 'doesZipCodeMatch', {
      value: 0,
      threshold: 100,
      pass: passes.doesZipCodeMatch,
    });

    scoreAddressDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([]);
  });

  test('does not disqualify when only some fields were even comparable, even if all compared ones disagree', () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: 'Aldric A Moon' }));
    const candidate = addSomeoneMoon(state, { trusteeId: 't1' });
    addScore(candidate, 'doesCityMatch', { value: 0, threshold: 100, pass: false });
    addScore(candidate, 'doesStateMatch', { value: 0, threshold: 100, pass: false });
    // doesZipCodeMatch never ran at all (e.g. no zip on file) - absence, not disagreement.

    scoreAddressDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([]);
  });

  test('records no disqualifier when no scorer ran at all', () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: 'Aldric A Moon' }));
    const candidate = addSomeoneMoon(state, { trusteeId: 't1' });

    scoreAddressDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([]);
  });

  test('records no disqualifier when city/state/zip all agree', () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: 'Aldric A Moon' }));
    const candidate = addSomeoneMoon(state, { trusteeId: 't1' });
    addScore(candidate, 'doesCityMatch', { value: 100, threshold: 100, pass: true });
    addScore(candidate, 'doesStateMatch', { value: 100, threshold: 100, pass: true });
    addScore(candidate, 'doesZipCodeMatch', { value: 100, threshold: 100, pass: true });

    scoreAddressDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([]);
  });
});

describe('scoreNameDisqualifiers', () => {
  test('records a disqualifier when both first and last name are grossly dissimilar', () => {
    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'Irwin Zarth', firstName: 'Irwin', lastName: 'Zarth' }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Tam', lastName: 'Fenwick' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });

    scoreNameDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([
      expect.objectContaining({ scorer: 'nameDisqualifiers' }),
    ]);
  });

  test('does not disqualify when first name is near-exact even though last name is dissimilar', () => {
    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'Chadwin Sartelli', firstName: 'Chadwin', lastName: 'Sartelli' }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Chadwin', lastName: 'Pallavo' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });

    scoreNameDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([]);
  });

  test('does not disqualify when last name is near-exact even though first name is dissimilar', () => {
    const state = createInitialState(
      makeDxtrTrustee({
        fullName: 'Marisol Windemere',
        firstName: 'Marisol',
        lastName: 'Windemere',
      }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({ trusteeId: 't1', firstName: 'Percival', lastName: 'Windemere' }),
      ),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });

    scoreNameDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([]);
  });

  test('does not disqualify a close spelling variant on both name parts', () => {
    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'Odalys Fennimore', firstName: 'Odalys', lastName: 'Fennimore' }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Odalis', lastName: 'Finnamore' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });

    scoreNameDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([]);
  });

  test('does not disqualify when doesNameMatch has not scored exactly 0', () => {
    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'Irwin Zarth', firstName: 'Irwin', lastName: 'Zarth' }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Tam', lastName: 'Fenwick' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 85, threshold: 85, pass: true });

    scoreNameDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([]);
  });

  test('does not disqualify when either side is missing a first or last name', () => {
    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'Zarth', firstName: undefined, lastName: 'Zarth' }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Tam', lastName: 'Fenwick' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });

    scoreNameDisqualifiers(state.sourceNormalized, candidate);

    expect(candidate.disqualifiers).toEqual([]);
  });
});

describe('resolveBySoleFuzzyFirstNameMatchAfterAddressNarrowing', () => {
  const acmsRecord = makeDxtrTrustee({
    fullName: 'Tobin Vasquez',
    firstName: 'Tobin',
    lastName: 'Vasquez',
  });

  function addSameLastNameCandidate(
    state: PipelineState,
    trusteeId: string,
    firstName: string,
  ): PipelineCandidate {
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId, firstName, lastName: 'Vasquez' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 100,
      threshold: 100,
      pass: true,
    });
    return candidate;
  }

  function pushAddressDisqualifier(candidate: PipelineCandidate): void {
    candidate.disqualifiers.push({
      scorer: 'addressDisqualifiers',
      reason: 'city, state, and zip all actively disagree',
      evidence: {},
    });
  }

  test('resolves the sole survivor once address-disqualified same-surname candidates are excluded', async () => {
    const state = createInitialState(acmsRecord);
    const survivor = addSameLastNameCandidate(state, 't1', 'Tobias');
    const disqualified = addSameLastNameCandidate(state, 't2', 'Tabitha');
    pushAddressDisqualifier(disqualified);

    const result = await resolveBySoleFuzzyFirstNameMatchAfterAddressNarrowing()(state);

    expect(result.match).toEqual({ trusteeId: 't1', score: survivor.scores });
  });

  test("does not resolve when only a sole same-surname candidate exists - not this stage's job", async () => {
    const state = createInitialState(acmsRecord);
    addSameLastNameCandidate(state, 't1', 'Tobias');

    const result = await resolveBySoleFuzzyFirstNameMatchAfterAddressNarrowing()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when two or more candidates survive address-narrowing', async () => {
    const state = createInitialState(acmsRecord);
    addSameLastNameCandidate(state, 't1', 'Tobias');
    addSameLastNameCandidate(state, 't2', 'Tobiah');

    const result = await resolveBySoleFuzzyFirstNameMatchAfterAddressNarrowing()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when narrowing eliminates every candidate', async () => {
    const state = createInitialState(acmsRecord);
    const first = addSameLastNameCandidate(state, 't1', 'Tobias');
    pushAddressDisqualifier(first);
    const second = addSameLastNameCandidate(state, 't2', 'Tabitha');
    pushAddressDisqualifier(second);

    const result = await resolveBySoleFuzzyFirstNameMatchAfterAddressNarrowing()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when the sole survivor is not a plausible fuzzy first-name match', async () => {
    const state = createInitialState(acmsRecord);
    addSameLastNameCandidate(state, 't1', 'Marguerite');
    const disqualified = addSameLastNameCandidate(state, 't2', 'Tabitha');
    pushAddressDisqualifier(disqualified);

    const result = await resolveBySoleFuzzyFirstNameMatchAfterAddressNarrowing()(state);

    expect(result.match).toBeNull();
  });

  test('ignores a disqualifier from an unrelated scorer - only addressDisqualifiers narrows this pool', async () => {
    const state = createInitialState(acmsRecord);
    const survivor = addSameLastNameCandidate(state, 't1', 'Tobias');
    const other = addSameLastNameCandidate(state, 't2', 'Tabitha');
    other.disqualifiers.push({
      scorer: 'someHypotheticalUnrelatedScorer',
      reason: 'not an address reason',
      evidence: {},
    });

    const result = await resolveBySoleFuzzyFirstNameMatchAfterAddressNarrowing()(state);

    expect(result.match).toBeNull();
    expect(survivor.scores).not.toHaveProperty(
      'resolveBySoleFuzzyFirstNameMatchAfterAddressNarrowing',
    );
  });
});

describe('resolveBySoleContactMatch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('resolves the sole name-qualifying candidate when its already-computed contact score corroborates', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(candidate, 'contactCorroborationPhone', { value: 100, threshold: 100, pass: true });

    const result = await resolveBySoleContactMatch()(state);

    expect(result.match).toEqual({ trusteeId: 't1', score: candidate.scores });
  });

  test('resolves via the no-contradiction fallback when there is no comparable phone/email and the ACMS address does not contradict', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 100,
      threshold: 100,
      pass: true,
    });
    // No contactCorroborationPhone/Email at all (uncomparable), and no
    // contactCorroborationAddress recorded either (nothing to contradict).

    const result = await resolveBySoleContactMatch()(state);

    expect(result.match).toEqual({ trusteeId: 't1', score: candidate.scores });
  });

  test('refuses the no-contradiction fallback when the ACMS record has no real contact data at all', async () => {
    const state = createInitialState(
      makeDxtrTrustee({ legacy: { phone: '0', fax: '0' } as never }),
    );
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 0,
      threshold: 100,
      pass: false,
    });

    const result = await resolveBySoleContactMatch()(state);

    expect(result.match).toBeNull();
  });

  // Models a real backtest regression (e.g. ACMS "DIANE WEIL (TR)", cityStateZipCountry
  // "WOODLAND HILLS 91367-0000" with no state token at all): pipelineAddressScore also returns 0
  // immediately when the ACMS address doesn't parse - a low contactCorroborationAddress score here
  // means "unparseable," not "genuinely disagrees," so it must not block the no-contradiction
  // fallback the way an actually-parsed, actually-disagreeing address does.
  test('resolves via the no-contradiction fallback when a low addressScore reflects an unparseable ACMS address, not a genuine disagreement', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(candidate, 'contactCorroborationAddress', { value: 0, threshold: 80, pass: false });
    // state.sourceNormalized.address deliberately left unset - the ACMS address never parsed.

    const result = await resolveBySoleContactMatch()(state);

    expect(result.match).toEqual({ trusteeId: 't1', score: candidate.scores });
  });

  test('refuses the no-contradiction fallback when the ACMS address actively contradicts a low addressScore', async () => {
    const state = createInitialState(makeDxtrTrustee());
    // A PARSEABLE ACMS address (state.sourceNormalized.address populated, mirroring what
    // memoizedParseAcmsAddress would set for a real, well-formed cityStateZipCountry) - this is
    // what distinguishes "the address genuinely disagrees" from "the address never parsed at all"
    // (see isNoContradictionMatch's own doc comment for the real regression this distinction fixes).
    state.sourceNormalized.address = { city: 'Anytown', state: 'CA', zipCode: '90001' };
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(candidate, 'contactCorroborationAddress', { value: 5, threshold: 80, pass: false });

    const result = await resolveBySoleContactMatch()(state);

    expect(result.match).toBeNull();
  });

  // CAMS-876 (post-cams-evxgm): resolveBySoleContactMatch deliberately never auto-links a
  // multi-candidate, same-name pool via a candidate-vs-candidate comparison (see its own doc
  // comment on why resolveDuplicateNameCandidates was removed - its "these are likely the same
  // real person, filed twice" premise was checked against a real trustees export and found false
  // for both of its own canary examples). Two name-qualifying candidates must stay unresolved
  // here, regardless of which one might otherwise look more "complete."
  test('leaves state.match null when 2+ candidates qualify on name, never guessing between them', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const first = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));
    addScore(first, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    const second = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't2' })));
    addScore(second, 'doesNameMatch', { value: 85, threshold: 85, pass: true });

    const result = await resolveBySoleContactMatch()(state);

    expect(result.match).toBeNull();
  });

  test('leaves state.match null when the sole name-qualifying candidate has no corroboration and real contact data to contradict it', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));
    addScore(candidate, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 100,
      threshold: 100,
      pass: true,
    });
    addScore(candidate, 'contactCorroborationAddress', { value: 5, threshold: 80, pass: false });

    const result = await resolveBySoleContactMatch()(state);

    expect(result.match).toBeNull();
  });
});

describe('resolveByComparativeCorroboration', () => {
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
    addScore(bruceHalden, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    addScore(bruceHalden, 'contactCorroborationPhone', { value: 0, threshold: 100, pass: false });
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
    addScore(marcusFeld, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    addScore(marcusFeld, 'contactCorroborationPhone', { value: 100, threshold: 100, pass: true });

    const result = await resolveByComparativeCorroboration()(state);

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
    addScore(first, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
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
    addScore(second, 'doesNameMatch', { value: 85, threshold: 85, pass: true });

    const result = await resolveByComparativeCorroboration()(state);

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
    addScore(first, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
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
    addScore(second, 'doesNameMatch', { value: 85, threshold: 85, pass: true });

    const result = await resolveByComparativeCorroboration()(state);

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
    addScore(nameNoMatch, 'doesNameMatch', { value: 0, threshold: 85, pass: false });

    const result = await resolveByComparativeCorroboration()(state);

    expect(result.match).toBeNull();
  });

  // Models a real backtest finding (anonymized "Jan Johnson"/"Conway" shape): two name-qualifying
  // candidates, neither clears CONTACT_CORROBORATION_ADDRESS_THRESHOLD (calculateAddressScore's
  // 50% address-lines weighting keeps a full-geo-agreement candidate's blended score around 50),
  // but exactly one has full city+state+zip agreement while the other shares nothing but the name.
  test('resolves to the sole candidate with full city+state+zip agreement when no candidate clears the address/phone bar', async () => {
    const state = createInitialState(acmsMarcusFeld);
    const noGeoAgreement = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'no-geo-agreement',
          name: 'Marcus Feld',
          public: {
            address: {
              address1: '1 Unrelated St',
              city: 'Nowhere',
              state: 'ZZ',
              zipCode: '00000',
              countryCode: 'US',
            },
            phone: { number: '555-555-9999' },
          },
        }),
      ),
    );
    addScore(noGeoAgreement, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    addScore(noGeoAgreement, 'doesCityMatch', { value: 0, threshold: 100, pass: false });
    addScore(noGeoAgreement, 'doesStateMatch', { value: 0, threshold: 100, pass: false });
    addScore(noGeoAgreement, 'doesZipCodeMatch', { value: 0, threshold: 100, pass: false });

    const fullGeoAgreement = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'full-geo-agreement',
          name: 'Marcus J. Feld',
          public: {
            address: {
              address1: '1 Different Building, Suite 9',
              city: 'Fictionville',
              state: 'WA',
              zipCode: '98999',
              countryCode: 'US',
            },
            phone: { number: '555-555-8888' },
          },
        }),
      ),
    );
    addScore(fullGeoAgreement, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    addScore(fullGeoAgreement, 'doesCityMatch', { value: 100, threshold: 100, pass: true });
    addScore(fullGeoAgreement, 'doesStateMatch', { value: 100, threshold: 100, pass: true });
    addScore(fullGeoAgreement, 'doesZipCodeMatch', { value: 100, threshold: 100, pass: true });

    const result = await resolveByComparativeCorroboration()(state);

    expect(result.match).toEqual({
      trusteeId: 'full-geo-agreement',
      score: fullGeoAgreement.scores,
    });
  });

  test('does not resolve via full geo agreement when more than one qualifying candidate has it', async () => {
    const state = createInitialState(acmsMarcusFeld);
    const first = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'candidate-1',
          name: 'Marcus Feld',
          public: {
            address: {
              address1: '1 Building A',
              city: 'Fictionville',
              state: 'WA',
              zipCode: '98999',
              countryCode: 'US',
            },
            phone: { number: '555-555-1111' },
          },
        }),
      ),
    );
    addScore(first, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    addScore(first, 'doesCityMatch', { value: 100, threshold: 100, pass: true });
    addScore(first, 'doesStateMatch', { value: 100, threshold: 100, pass: true });
    addScore(first, 'doesZipCodeMatch', { value: 100, threshold: 100, pass: true });

    const second = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'candidate-2',
          name: 'Marcus J. Feld',
          public: {
            address: {
              address1: '1 Building B',
              city: 'Fictionville',
              state: 'WA',
              zipCode: '98999',
              countryCode: 'US',
            },
            phone: { number: '555-555-2222' },
          },
        }),
      ),
    );
    addScore(second, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    addScore(second, 'doesCityMatch', { value: 100, threshold: 100, pass: true });
    addScore(second, 'doesStateMatch', { value: 100, threshold: 100, pass: true });
    addScore(second, 'doesZipCodeMatch', { value: 100, threshold: 100, pass: true });

    const result = await resolveByComparativeCorroboration()(state);

    expect(result.match).toBeNull();
  });

  test('prefers strong address/phone corroboration over full geo agreement when both exist', async () => {
    const state = createInitialState(acmsMarcusFeld);
    const geoOnly = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'geo-only',
          name: 'Marcus Feld',
          public: {
            address: {
              address1: '1 Different Building',
              city: 'Fictionville',
              state: 'WA',
              zipCode: '98999',
              countryCode: 'US',
            },
            phone: { number: '555-555-1111' },
          },
        }),
      ),
    );
    addScore(geoOnly, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    addScore(geoOnly, 'doesCityMatch', { value: 100, threshold: 100, pass: true });
    addScore(geoOnly, 'doesStateMatch', { value: 100, threshold: 100, pass: true });
    addScore(geoOnly, 'doesZipCodeMatch', { value: 100, threshold: 100, pass: true });

    const exactPhone = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'exact-phone',
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
    addScore(exactPhone, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    addScore(exactPhone, 'contactCorroborationPhone', { value: 100, threshold: 100, pass: true });

    const result = await resolveByComparativeCorroboration()(state);

    expect(result.match).toEqual({
      trusteeId: 'exact-phone',
      score: expect.objectContaining({
        contactCorroborationPhone: expect.objectContaining({ value: 100, pass: true }),
      }),
    });
  });
});

describe('scoreCandidate - contact-corroboration facet', () => {
  const acmsMarcusFeld = makeDxtrTrustee({
    fullName: 'Marcus Feld',
    firstName: 'Marcus',
    lastName: 'Feld',
    legacy: {
      address1: 'PO Box 100',
      cityStateZipCountry: 'Fictionville, WA 98999',
      phone: '2065551000',
      email: 'marcus.feld@example.com',
    },
  });

  test('records contactCorroborationAddress/Phone/Email for a candidate, unconditionally (no pool-size gate)', () => {
    const state = createInitialState(acmsMarcusFeld);
    const candidate = addAndScoreCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'j-marcus-feld',
          name: 'J. Marcus Feld',
          public: {
            address: {
              address1: '1 Fictional Ave',
              city: 'Fictionville',
              state: 'WA',
              zipCode: '98999',
              countryCode: 'US',
            },
            phone: { number: '206-555-1000' },
            email: 'marcus.feld@example.com',
          },
        }),
      ),
    );

    expect(mergedScore(candidate)).toMatchObject({
      contactCorroborationPhone: { value: 100, pass: true },
      contactCorroborationEmail: { value: 100, pass: true },
    });
  });

  test('records a non-passing contactCorroborationPhone when the phone genuinely differs', () => {
    const state = createInitialState(acmsMarcusFeld);
    const candidate = addAndScoreCandidate(
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

    expect(mergedScore(candidate)).toMatchObject({
      contactCorroborationPhone: { value: 0, pass: false },
    });
  });

  test('does not record contactCorroborationEmail when either side has no email', () => {
    const state = createInitialState(makeDxtrTrustee({ fullName: 'No Email Here' }));
    const candidate = addAndScoreCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'No Email Here' })),
    );

    expect(candidate.scores).not.toHaveProperty('contactCorroborationEmail');
  });
});

describe('scoreCandidate - phone-typo-tolerance facet', () => {
  // Models a real backtest finding (anonymized): an ACMS record for "Terrence Boyle" has a CAMS
  // candidate, "Terrence J. Boyle", an EXACT structured name match (nameScore=100), whose
  // recorded phone differs by exactly the LAST digit - a real, comparable, MISMATCHED number, not
  // a missing one. resolveByContactCorroboration's isNoContradictionMatch fallback never triggers
  // here - it only relaxes when phoneScore is null (uncomparable), not merely mismatched. A
  // backtest of the real 245-record population sharing this exact shape (sole candidate,
  // nameScore=100, a comparable-but-mismatched phone) found phone numbers differing by 1-2 digits
  // are essentially always a typo (still the same person), while numbers differing by 8-10 digits
  // are genuinely different phone numbers - calculatePhoneScore's binary 100-or-0 can't
  // distinguish the two, so scoreCandidate adds digit-hamming-distance as a new, pipeline-only
  // diagnostic to recover the former without touching the latter. Computed unconditionally for
  // every nameScore=100 candidate - not gated to the pool having exactly one qualifying candidate
  // (see resolveByPhoneTypoTolerance for the still-sole-candidate-gated RESOLVE decision).
  const acmsTerrenceBoyle = makeDxtrTrustee({
    fullName: 'Terrence Boyle',
    firstName: 'Terrence',
    lastName: 'Boyle',
    legacy: {
      cityStateZipCountry: 'Fictionburg, NY 10999',
      phone: '2125550100',
    },
  });

  // Runs normalizeAcmsSourceName first, matching real pipeline stage ordering - scoreNameMatch
  // reads state.sourceNormalized directly (already normalizeNamePart/firstLastNameToken-reduced,
  // lowercase), not state.sourceRaw's original casing.
  test('records phoneTypoToleranceScore for a nameScore=100 candidate whose phone differs by only 1-2 digits', async () => {
    const state = await normalizeAcmsSourceName()(createInitialState(acmsTerrenceBoyle));
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

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      phoneTypoToleranceScore: expect.objectContaining({
        pass: true,
        phoneDigitDistance: expect.any(Number),
      }),
    });
  });

  const makeTerrenceBoyleCandidate = (state: PipelineState, phone: string) =>
    addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'terrence-j-boyle',
          firstName: 'Terrence',
          lastName: 'Boyle',
          name: 'Terrence Boyle',
          public: {
            address: {
              address1: '1 Fictional Way',
              city: 'Fictionburg',
              state: 'NY',
              zipCode: '10999',
              countryCode: 'US',
            },
            phone: { number: phone },
          },
        }),
      ),
    );

  test("records a non-passing phoneTypoToleranceScore when the candidate's phone is genuinely a different number", async () => {
    const state = await normalizeAcmsSourceName()(createInitialState(acmsTerrenceBoyle));
    const candidate = makeTerrenceBoyleCandidate(state, '425-894-9945');

    scoreCandidate(state.sourceNormalized, candidate);

    expect(mergedScore(candidate)).toMatchObject({
      phoneTypoToleranceScore: expect.objectContaining({ pass: false }),
    });
  });

  test('does not record phoneTypoToleranceScore when the candidate phone is not comparable (fewer than 10 digits)', () => {
    const state = createInitialState(acmsTerrenceBoyle);
    const candidate = makeTerrenceBoyleCandidate(state, '5550640');

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).not.toHaveProperty('phoneTypoToleranceScore');
  });

  test('does not record phoneTypoToleranceScore when nameScore is 85, not a perfect 100', () => {
    const state = createInitialState(acmsTerrenceBoyle);
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({
          trusteeId: 'terrence-j-boyle',
          firstName: 'T',
          lastName: 'Boyle',
          name: 'T. Boyle',
          public: {
            address: {
              address1: '1 Fictional Way',
              city: 'Fictionburg',
              state: 'NY',
              zipCode: '10999',
              countryCode: 'US',
            },
            phone: { number: '212-573-0640' },
          },
        }),
      ),
    );

    scoreCandidate(state.sourceNormalized, candidate);

    expect(candidate.scores).not.toHaveProperty('phoneTypoToleranceScore');
  });
});

describe('resolveByPhoneTypoTolerance', () => {
  const acmsTerrenceBoyle = makeDxtrTrustee({ fullName: 'Terrence Boyle' });

  test('resolves the sole exact-name candidate whose already-computed phoneTypoToleranceScore passes', async () => {
    const state = createInitialState(acmsTerrenceBoyle);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 'terrence-j-boyle', name: 'Terrence J. Boyle' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(candidate, 'phoneTypoToleranceScore', {
      value: 9,
      threshold: 8,
      pass: true,
      phoneDigitDistance: 1,
    });

    const result = await resolveByPhoneTypoTolerance()(state);

    expect(result.match).toEqual({
      trusteeId: 'terrence-j-boyle',
      score: expect.objectContaining({
        phoneTypoToleranceScore: expect.objectContaining({ phoneDigitDistance: 1 }),
      }),
    });
  });

  test.each([
    {
      description: "sole candidate's phoneTypoToleranceScore does not pass",
      nameScore: 100,
      phoneScore: { value: 5, threshold: 8, pass: false, phoneDigitDistance: 5 },
    },
    {
      description: 'nameScore is 85, not a perfect 100',
      nameScore: 85,
      phoneScore: { value: 9, threshold: 8, pass: true, phoneDigitDistance: 1 },
    },
    {
      description: 'no phoneTypoToleranceScore was ever recorded',
      nameScore: 100,
      phoneScore: undefined,
    },
  ])('does not resolve when $description', async ({ nameScore, phoneScore }) => {
    const state = createInitialState(acmsTerrenceBoyle);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 'terrence-j-boyle', name: 'Marisol B. Quade' })),
    );
    addScore(candidate, 'doesNameMatch', { value: nameScore, threshold: 85, pass: true });
    if (phoneScore) addScore(candidate, 'phoneTypoToleranceScore', phoneScore);

    const result = await resolveByPhoneTypoTolerance()(state);

    expect(result.match).toBeNull();
  });

  test("does not resolve when more than one candidate qualifies - not this stage's job", async () => {
    const state = createInitialState(acmsTerrenceBoyle);
    const first = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 'candidate-1', name: 'Marisol Quade' })),
    );
    addScore(first, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(first, 'phoneTypoToleranceScore', {
      value: 9,
      threshold: 8,
      pass: true,
      phoneDigitDistance: 1,
    });
    const second = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 'candidate-2', name: 'Marisol R. Quade' })),
    );
    addScore(second, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(second, 'phoneTypoToleranceScore', {
      value: 9,
      threshold: 8,
      pass: true,
      phoneDigitDistance: 1,
    });

    const result = await resolveByPhoneTypoTolerance()(state);

    expect(result.match).toBeNull();
  });
});

describe('resolveBySoleExactNameMatch', () => {
  const acmsRecord = makeDxtrTrustee({ fullName: 'Ronald Durkin' });

  test('resolves a sole exact-name candidate with no state/city/zip evidence at all', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Ronald L. Durkin' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });

    const result = await resolveBySoleExactNameMatch()(state);

    expect(result.match).toEqual({ trusteeId: 't1', score: candidate.scores });
  });

  test('resolves an office-relocation case: state and zip corroborate even though city differs', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Ronald L. Durkin' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(candidate, 'doesStateMatch', { value: 100, threshold: 100, pass: true });
    addScore(candidate, 'doesCityMatch', { value: 0, threshold: 100, pass: false });
    addScore(candidate, 'doesZipCodeMatch', { value: 100, threshold: 100, pass: true });

    const result = await resolveBySoleExactNameMatch()(state);

    expect(result.match).toEqual({ trusteeId: 't1', score: candidate.scores });
  });

  test('resolves even when state disagrees - name alone is enough for a sole candidate', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Ronald L. Durkin' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(candidate, 'doesStateMatch', { value: 0, threshold: 100, pass: false });

    const result = await resolveBySoleExactNameMatch()(state);

    expect(result.match).toEqual({ trusteeId: 't1', score: candidate.scores });
  });

  test('does not resolve a fuzzy (non-exact) 85 name score', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Ronald L. Durkin' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 85, threshold: 85, pass: true });

    const result = await resolveBySoleExactNameMatch()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when more than one candidate has an exact name match', async () => {
    const state = createInitialState(acmsRecord);
    const first = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Ronald L. Durkin' })),
    );
    addScore(first, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    const second = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't2', name: 'Ronald L. Durkin' })),
    );
    addScore(second, 'doesNameMatch', { value: 100, threshold: 85, pass: true });

    const result = await resolveBySoleExactNameMatch()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve a candidate excluded by doesCamsTrusteeHaveAddressAndPhone', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Ronald L. Durkin' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(candidate, 'doesCamsTrusteeHaveAddressAndPhone', {
      value: 0,
      threshold: 100,
      pass: false,
    });

    const result = await resolveBySoleExactNameMatch()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when the ACMS record itself has no contact data, even with an exact name match', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Ronald L. Durkin' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 0,
      threshold: 100,
      pass: false,
    });

    const result = await resolveBySoleExactNameMatch()(state);

    expect(result.match).toBeNull();
  });
});

describe('resolveBySoleExactNameMatchNoAcmsData', () => {
  const acmsRecord = makeDxtrTrustee({ fullName: 'Aldric Vossmeier', firstName: 'Aldric' });

  test('resolves a sole exact-name candidate when ACMS has zero comparable contact data', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Aldric R. Vossmeier' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 0,
      threshold: 100,
      pass: false,
    });

    const result = await resolveBySoleExactNameMatchNoAcmsData()(state);

    expect(result.match).toEqual({ trusteeId: 't1', score: candidate.scores });
  });

  test('resolves the sole exact-name survivor even alongside many correctly-rejected candidates', async () => {
    const state = createInitialState(acmsRecord);
    const winner = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Aldric R. Vossmeier' })),
    );
    addScore(winner, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(winner, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 0,
      threshold: 100,
      pass: false,
    });
    for (const [trusteeId, name] of [
      ['t2', 'Marlowe P. Ashgrove'],
      ['t3', 'Natalie A. Winterbourne'],
    ] as const) {
      const rejected = addCandidate(state, projectTrustee(makeTrustee({ trusteeId, name })));
      addScore(rejected, 'doesNameMatch', { value: 0, threshold: 85, pass: false });
      addScore(rejected, 'doesAcmsTrusteeHaveAddressAndPhone', {
        value: 0,
        threshold: 100,
        pass: false,
      });
    }

    const result = await resolveBySoleExactNameMatchNoAcmsData()(state);

    expect(result.match).toEqual({ trusteeId: 't1', score: winner.scores });
  });

  test("does not resolve when ACMS has real contact data - that is resolveBySoleExactNameMatch's job", async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Aldric R. Vossmeier' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 100,
      threshold: 100,
      pass: true,
    });

    const result = await resolveBySoleExactNameMatchNoAcmsData()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when doesAcmsTrusteeHaveAddressAndPhone was never scored at all', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Aldric R. Vossmeier' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });

    const result = await resolveBySoleExactNameMatchNoAcmsData()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve a fuzzy (non-exact) 85 name score', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Aldric R. Vossmeier' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 0,
      threshold: 100,
      pass: false,
    });

    const result = await resolveBySoleExactNameMatchNoAcmsData()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when more than one candidate has an exact name match', async () => {
    const state = createInitialState(acmsRecord);
    const first = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Aldric R. Vossmeier' })),
    );
    addScore(first, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(first, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 0,
      threshold: 100,
      pass: false,
    });
    const second = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't2', name: 'Aldric R. Vossmeier' })),
    );
    addScore(second, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(second, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 0,
      threshold: 100,
      pass: false,
    });

    const result = await resolveBySoleExactNameMatchNoAcmsData()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve a candidate excluded by doesCamsTrusteeHaveAddressAndPhone', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Aldric R. Vossmeier' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 0,
      threshold: 100,
      pass: false,
    });
    addScore(candidate, 'doesCamsTrusteeHaveAddressAndPhone', {
      value: 0,
      threshold: 100,
      pass: false,
    });

    const result = await resolveBySoleExactNameMatchNoAcmsData()(state);

    expect(result.match).toBeNull();
  });
});

describe('resolveBySoleFuzzyFirstNameMatchNoAcmsData', () => {
  const acmsRecord = makeDxtrTrustee({
    fullName: 'Tobin Vasquez',
    firstName: 'Tobin',
    lastName: 'Vasquez',
  });

  test('resolves a sole fuzzy-first-name candidate when ACMS has zero comparable contact data', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Tobias', lastName: 'Vasquez' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 0,
      threshold: 100,
      pass: false,
    });

    const result = await resolveBySoleFuzzyFirstNameMatchNoAcmsData()(state);

    expect(result.match).toEqual({ trusteeId: 't1', score: candidate.scores });
  });

  test('does not resolve when the first name is not a plausible fuzzy match', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({ trusteeId: 't1', firstName: 'Marguerite', lastName: 'Vasquez' }),
      ),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 0,
      threshold: 100,
      pass: false,
    });

    const result = await resolveBySoleFuzzyFirstNameMatchNoAcmsData()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when the lastName does not match exactly', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Tobias', lastName: 'Velasquez' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 0,
      threshold: 100,
      pass: false,
    });

    const result = await resolveBySoleFuzzyFirstNameMatchNoAcmsData()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when ACMS has real contact data', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Tobias', lastName: 'Vasquez' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 100,
      threshold: 100,
      pass: true,
    });

    const result = await resolveBySoleFuzzyFirstNameMatchNoAcmsData()(state);

    expect(result.match).toBeNull();
  });

  test("does not resolve when the candidate already cleared the name threshold - not this stage's job", async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Tobin', lastName: 'Vasquez' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 0,
      threshold: 100,
      pass: false,
    });

    const result = await resolveBySoleFuzzyFirstNameMatchNoAcmsData()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when more than one candidate shares the exact lastName', async () => {
    const state = createInitialState(acmsRecord);
    const first = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Tobias', lastName: 'Vasquez' })),
    );
    addScore(first, 'doesNameMatch', { value: 0, threshold: 85, pass: false });
    addScore(first, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 0,
      threshold: 100,
      pass: false,
    });
    const second = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't2', firstName: 'Tabitha', lastName: 'Vasquez' })),
    );
    addScore(second, 'doesNameMatch', { value: 0, threshold: 85, pass: false });
    addScore(second, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 0,
      threshold: 100,
      pass: false,
    });

    const result = await resolveBySoleFuzzyFirstNameMatchNoAcmsData()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve a candidate excluded by doesCamsTrusteeHaveAddressAndPhone', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Tobias', lastName: 'Vasquez' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 0,
      threshold: 100,
      pass: false,
    });
    addScore(candidate, 'doesCamsTrusteeHaveAddressAndPhone', {
      value: 0,
      threshold: 100,
      pass: false,
    });

    const result = await resolveBySoleFuzzyFirstNameMatchNoAcmsData()(state);

    expect(result.match).toBeNull();
  });
});

describe('resolveRisky', () => {
  const acmsRecord = makeDxtrTrustee({ fullName: 'Winslow Petrakis', firstName: 'Winslow' });

  test('resolves via the exact-name-no-ACMS-data sub-stage', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Winslow Petrakis' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 0,
      threshold: 100,
      pass: false,
    });

    const result = await resolveRisky()(state);

    expect(result.match).toEqual({ trusteeId: 't1', score: candidate.scores });
  });

  test('resolves via the fuzzy-first-name-no-ACMS-data sub-stage when the exact-match sub-stage does not apply', async () => {
    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'Tobin Vasquez', firstName: 'Tobin', lastName: 'Vasquez' }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Tobias', lastName: 'Vasquez' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 0,
      threshold: 100,
      pass: false,
    });

    const result = await resolveRisky()(state);

    expect(result.match).toEqual({ trusteeId: 't1', score: candidate.scores });
  });

  test('does not resolve when neither risky sub-stage applies', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Else' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });
    addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', {
      value: 100,
      threshold: 100,
      pass: true,
    });

    const result = await resolveRisky()(state);

    expect(result.match).toBeNull();
  });
});

describe('resolveBySoleExactNameMatchByStateThenGeo', () => {
  const acmsRecord = makeDxtrTrustee({ fullName: 'Ronald Durkin' });

  function addExactNameCandidate(
    state: PipelineState,
    trusteeId: string,
    name: string,
  ): PipelineCandidate {
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId, name })));
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    return candidate;
  }

  test("does not resolve when only a sole candidate qualifies - not this stage's job", async () => {
    const state = createInitialState(acmsRecord);
    addExactNameCandidate(state, 't1', 'Ronald L. Durkin');

    const result = await resolveBySoleExactNameMatchByStateThenGeo()(state);

    expect(result.match).toBeNull();
  });

  test('resolves when exactly one of several exact-name candidates has a matching state', async () => {
    const state = createInitialState(acmsRecord);
    const winner = addExactNameCandidate(state, 't1', 'Ronald L. Durkin');
    addScore(winner, 'doesStateMatch', { value: 100, threshold: 100, pass: true });
    const other = addExactNameCandidate(state, 't2', 'Ronald L. Durkin');
    addScore(other, 'doesStateMatch', { value: 0, threshold: 100, pass: false });

    const result = await resolveBySoleExactNameMatchByStateThenGeo()(state);

    expect(result.match).toEqual({ trusteeId: 't1', score: winner.scores });
  });

  test('narrows by city-or-zip when two candidates still agree on state', async () => {
    const state = createInitialState(acmsRecord);
    const winner = addExactNameCandidate(state, 't1', 'Ronald L. Durkin');
    addScore(winner, 'doesStateMatch', { value: 100, threshold: 100, pass: true });
    addScore(winner, 'doesZipCodeMatch', { value: 100, threshold: 100, pass: true });
    const other = addExactNameCandidate(state, 't2', 'Ronald L. Durkin');
    addScore(other, 'doesStateMatch', { value: 100, threshold: 100, pass: true });
    addScore(other, 'doesZipCodeMatch', { value: 0, threshold: 100, pass: false });

    const result = await resolveBySoleExactNameMatchByStateThenGeo()(state);

    expect(result.match).toEqual({ trusteeId: 't1', score: winner.scores });
  });

  test('does not resolve when no candidate has a matching state', async () => {
    const state = createInitialState(acmsRecord);
    const first = addExactNameCandidate(state, 't1', 'Ronald L. Durkin');
    addScore(first, 'doesStateMatch', { value: 0, threshold: 100, pass: false });
    const second = addExactNameCandidate(state, 't2', 'Ronald L. Durkin');
    addScore(second, 'doesStateMatch', { value: 0, threshold: 100, pass: false });

    const result = await resolveBySoleExactNameMatchByStateThenGeo()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when two candidates still agree on state AND city-or-zip', async () => {
    const state = createInitialState(acmsRecord);
    const first = addExactNameCandidate(state, 't1', 'Ronald L. Durkin');
    addScore(first, 'doesStateMatch', { value: 100, threshold: 100, pass: true });
    addScore(first, 'doesCityMatch', { value: 100, threshold: 100, pass: true });
    const second = addExactNameCandidate(state, 't2', 'Ronald L. Durkin');
    addScore(second, 'doesStateMatch', { value: 100, threshold: 100, pass: true });
    addScore(second, 'doesCityMatch', { value: 100, threshold: 100, pass: true });

    const result = await resolveBySoleExactNameMatchByStateThenGeo()(state);

    expect(result.match).toBeNull();
  });
});

describe('resolveByConsensus', () => {
  const acmsRecord = makeDxtrTrustee({ fullName: 'Aldric A Moon' });

  test('resolves a sole nameScore=85 candidate when every corroborating vote passes', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    addScore(candidate, 'isStateNotConflicting', { value: 100, threshold: 100, pass: true });
    addScore(candidate, 'doesCityMatch', { value: 100, threshold: 100, pass: true });
    addScore(candidate, 'doesZipCodeMatch', { value: 100, threshold: 100, pass: true });

    const result = await resolveByConsensus()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: expect.objectContaining({
        resolveByConsensus: expect.objectContaining({ pass: true }),
      }),
    });
  });

  test('does not resolve when most votes fail', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    addScore(candidate, 'isStateNotConflicting', { value: 100, threshold: 100, pass: true });
    addScore(candidate, 'doesCityMatch', { value: 0, threshold: 100, pass: false });
    addScore(candidate, 'contactCorroborationAddress', { value: 3, threshold: 80, pass: false });

    const result = await resolveByConsensus()(state);

    expect(result.match).toBeNull();
    expect(mergedScore(candidate)).toMatchObject({
      resolveByConsensus: { pass: false },
    });
  });

  // Models a real backtest finding (anonymized MI-03298): city and zip both agree even though
  // state does not (e.g. a stale/incorrect state field, or a zip code straddling a state line) -
  // isCorroboratedByGeoOrContact's city-and-zip fallback resolves this without requiring state.
  test('resolves when city and zip both agree even though state does not', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    addScore(candidate, 'isStateNotConflicting', { value: 100, threshold: 100, pass: true });
    addScore(candidate, 'doesStateMatch', { value: 0, threshold: 100, pass: false });
    addScore(candidate, 'doesCityMatch', { value: 100, threshold: 100, pass: true });
    addScore(candidate, 'doesZipCodeMatch', { value: 100, threshold: 100, pass: true });

    const result = await resolveByConsensus()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: expect.objectContaining({
        resolveByConsensus: expect.objectContaining({ pass: true }),
      }),
    });
  });

  // State agreement alone, with no city/zip/contact evidence at all, is deliberately NOT enough -
  // see isCorroboratedByGeoOrContact's doc comment on why a single-vote dominance case (backtested
  // as genuinely weak evidence) was excluded rather than preserved.
  test('does not resolve on state agreement alone, with no other evidence at all', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    addScore(candidate, 'isStateNotConflicting', { value: 100, threshold: 100, pass: true });
    addScore(candidate, 'doesStateMatch', { value: 100, threshold: 100, pass: true });

    const result = await resolveByConsensus()(state);

    expect(result.match).toBeNull();
    expect(mergedScore(candidate)).toMatchObject({
      resolveByConsensus: { pass: false },
    });
  });

  test('does not resolve when no corroborating scorer ran at all', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 85, threshold: 85, pass: true });

    const result = await resolveByConsensus()(state);

    expect(result.match).toBeNull();
    expect(candidate.scores.resolveByConsensus).toBeUndefined();
  });

  test('does not resolve when the candidate never cleared the name threshold', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Else' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });
    addScore(candidate, 'isStateNotConflicting', { value: 100, threshold: 100, pass: true });

    const result = await resolveByConsensus()(state);

    expect(result.match).toBeNull();
  });

  test("does not resolve when more than one candidate qualifies - not this stage's job", async () => {
    const state = createInitialState(acmsRecord);
    const first = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
    );
    addScore(first, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    addScore(first, 'isStateNotConflicting', { value: 100, threshold: 100, pass: true });
    const second = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't2', name: 'Someone Else Moon' })),
    );
    addScore(second, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    addScore(second, 'isStateNotConflicting', { value: 100, threshold: 100, pass: true });

    const result = await resolveByConsensus()(state);

    expect(result.match).toBeNull();
  });
});

describe('resolveBySoleFuzzyNameMatchAndState', () => {
  const acmsRecord = makeDxtrTrustee({ fullName: 'Aldric A Moon' });

  test('resolves a sole strong-name candidate on state agreement alone, with no city/zip/contact evidence', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    addScore(candidate, 'doesStateMatch', { value: 100, threshold: 100, pass: true });
    addScore(candidate, 'doesCityMatch', { value: 0, threshold: 100, pass: false });
    addScore(candidate, 'doesZipCodeMatch', { value: 0, threshold: 100, pass: false });

    const result = await resolveBySoleFuzzyNameMatchAndState()(state);

    expect(result.match).toEqual({
      trusteeId: 't1',
      score: expect.objectContaining({
        resolveBySoleFuzzyNameMatchAndState: expect.objectContaining({ pass: true }),
      }),
    });
  });

  test("does not resolve a sole EXACT-name (100) candidate - that is resolveBySoleExactNameMatch's job", async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Aldric A. Moon' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(candidate, 'doesStateMatch', { value: 100, threshold: 100, pass: true });

    const result = await resolveBySoleFuzzyNameMatchAndState()(state);

    expect(result.match).toBeNull();
  });

  test('does not resolve when state disagrees', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    addScore(candidate, 'doesStateMatch', { value: 0, threshold: 100, pass: false });

    const result = await resolveBySoleFuzzyNameMatchAndState()(state);

    expect(result.match).toBeNull();
    expect(mergedScore(candidate)).toMatchObject({
      resolveBySoleFuzzyNameMatchAndState: { pass: false },
    });
  });

  test('does not resolve when state was never compared at all', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 85, threshold: 85, pass: true });

    const result = await resolveBySoleFuzzyNameMatchAndState()(state);

    expect(result.match).toBeNull();
    expect(mergedScore(candidate)).toMatchObject({
      resolveBySoleFuzzyNameMatchAndState: { pass: false },
    });
  });

  test('does not resolve when the candidate never cleared the name threshold', async () => {
    const state = createInitialState(acmsRecord);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Else' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });
    addScore(candidate, 'doesStateMatch', { value: 100, threshold: 100, pass: true });

    const result = await resolveBySoleFuzzyNameMatchAndState()(state);

    expect(result.match).toBeNull();
  });

  test("does not resolve when more than one candidate qualifies - not this stage's job", async () => {
    const state = createInitialState(acmsRecord);
    const first = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', name: 'Someone Moon' })),
    );
    addScore(first, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    addScore(first, 'doesStateMatch', { value: 100, threshold: 100, pass: true });
    const second = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't2', name: 'Someone Else Moon' })),
    );
    addScore(second, 'doesNameMatch', { value: 85, threshold: 85, pass: true });
    addScore(second, 'doesStateMatch', { value: 100, threshold: 100, pass: true });

    const result = await resolveBySoleFuzzyNameMatchAndState()(state);

    expect(result.match).toBeNull();
  });
});

describe('resolveByFuzzyLastNameMatch', () => {
  const acmsRonaldGipson = makeDxtrTrustee({
    fullName: 'Ronald Gipson',
    firstName: 'Ronald',
    lastName: 'Gipson',
  });

  test('records a pass and resolves when a sole exact-firstName, fuzzy-lastName candidate clears the consensus bar', async () => {
    const state = createInitialState(acmsRonaldGipson);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Ronald', lastName: 'Gibson' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });
    addScore(candidate, 'isStateNotConflicting', { value: 100, threshold: 100, pass: true });
    addScore(candidate, 'doesStateMatch', { value: 100, threshold: 100, pass: true });
    addScore(candidate, 'doesCityMatch', { value: 100, threshold: 100, pass: true });

    const result = await resolveByFuzzyLastNameMatch()(state);

    expect(mergedScore(candidate)).toMatchObject({ doesFuzzyLastNameMatch: { pass: true } });
    expect(result.match).toEqual({
      trusteeId: 't1',
      score: expect.objectContaining({
        resolveByFuzzyLastNameMatch: expect.objectContaining({ pass: true }),
      }),
    });
  });

  test('does not resolve when most votes fail despite a plausible fuzzy-lastName match', async () => {
    const state = createInitialState(acmsRonaldGipson);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Ronald', lastName: 'Gibson' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });
    addScore(candidate, 'isStateNotConflicting', { value: 0, threshold: 100, pass: false });
    addScore(candidate, 'doesCityMatch', { value: 0, threshold: 100, pass: false });
    addScore(candidate, 'doesZipCodeMatch', { value: 0, threshold: 100, pass: false });

    const result = await resolveByFuzzyLastNameMatch()(state);

    expect(mergedScore(candidate)).toMatchObject({ doesFuzzyLastNameMatch: { pass: true } });
    expect(result.match).toBeNull();
  });

  test('does not run when the candidate lastName is not even a plausible fuzzy match', async () => {
    const state = createInitialState(acmsRonaldGipson);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Ronald', lastName: 'Thompson' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });

    const result = await resolveByFuzzyLastNameMatch()(state);

    expect(result.candidates.get('t1')!.scores.doesFuzzyLastNameMatch).toBeUndefined();
    expect(result.match).toBeNull();
  });

  test('does not run when the candidate firstName differs', async () => {
    const state = createInitialState(acmsRonaldGipson);
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({ trusteeId: 't1', firstName: 'Someone Else', lastName: 'Gibson' }),
      ),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });

    const result = await resolveByFuzzyLastNameMatch()(state);

    expect(result.candidates.get('t1')!.scores.doesFuzzyLastNameMatch).toBeUndefined();
    expect(result.match).toBeNull();
  });

  test('does not run when nameScore is nonzero (a genuinely ambiguous or partial match, not this pattern)', async () => {
    const state = createInitialState(acmsRonaldGipson);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Ronald', lastName: 'Gibson' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 85, threshold: 85, pass: true });

    const result = await resolveByFuzzyLastNameMatch()(state);

    expect(result.candidates.get('t1')!.scores.doesFuzzyLastNameMatch).toBeUndefined();
    expect(result.match).toBeNull();
  });

  test('does not run when more than one candidate qualifies', async () => {
    const state = createInitialState(acmsRonaldGipson);
    const first = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Ronald', lastName: 'Gibson' })),
    );
    addScore(first, 'doesNameMatch', { value: 0, threshold: 85, pass: false });
    const second = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't2', firstName: 'Ronald', lastName: 'Gipsen' })),
    );
    addScore(second, 'doesNameMatch', { value: 0, threshold: 85, pass: false });

    const result = await resolveByFuzzyLastNameMatch()(state);

    expect(result.candidates.get('t1')!.scores.doesFuzzyLastNameMatch).toBeUndefined();
    expect(result.candidates.get('t2')!.scores.doesFuzzyLastNameMatch).toBeUndefined();
    expect(result.match).toBeNull();
  });
});

// CAMS-mcwbx functional refactor: findSoleZeroNameScoreCandidateWithMatchingLastName's "exactly
// one qualifies" narrowing is itself RESOLVE-role reasoning (per the ADR's own definition -
// reasoning over a candidate's ALREADY-accumulated scores to reach a narrower candidate set), so
// it is composed directly into this one resolver rather than split across a separate "scores
// only" stage (formerly scoreFuzzyFirstNameMatch) the way it used to be - see
// resolveByFuzzyLastNameMatch's own doc comment for the same composed shape, applied here for the
// mirror-image name-part pattern.
describe('resolveByLastNameOnlyConsensus', () => {
  const acmsGeoffGroshong = makeDxtrTrustee({
    fullName: 'Geoff Groshong',
    firstName: 'Geoff',
    lastName: 'Groshong',
  });

  test('records the fuzzy first-name vote and resolves when a sole exact-lastName candidate with a plausible nickname also clears consensus', async () => {
    const state = createInitialState(acmsGeoffGroshong);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Geoffrey', lastName: 'Groshong' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });
    addScore(candidate, 'isStateNotConflicting', { value: 100, threshold: 100, pass: true });
    addScore(candidate, 'doesStateMatch', { value: 100, threshold: 100, pass: true });
    addScore(candidate, 'doesCityMatch', { value: 100, threshold: 100, pass: true });

    const result = await resolveByLastNameOnlyConsensus()(state);

    expect(mergedScore(candidate)).toMatchObject({ doesFuzzyFirstNameMatch: { pass: true } });
    expect(result.match).toEqual({
      trusteeId: 't1',
      score: expect.objectContaining({
        resolveByLastNameOnlyConsensus: expect.objectContaining({ pass: true }),
      }),
    });
  });

  test('records a failing fuzzy first-name vote and does not resolve when the first name is not plausibly related', async () => {
    const state = createInitialState(
      makeDxtrTrustee({ fullName: 'Harry Campbell', firstName: 'Harry', lastName: 'Campbell' }),
    );
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Kevin', lastName: 'Campbell' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });

    const result = await resolveByLastNameOnlyConsensus()(state);

    expect(mergedScore(candidate)).toMatchObject({ doesFuzzyFirstNameMatch: { pass: false } });
    expect(result.match).toBeNull();
  });

  test('records a passing fuzzy first-name vote but does not resolve without independent corroboration', async () => {
    const state = createInitialState(acmsGeoffGroshong);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Geoffrey', lastName: 'Groshong' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });
    addScore(candidate, 'isStateNotConflicting', { value: 0, threshold: 100, pass: false });
    addScore(candidate, 'doesCityMatch', { value: 0, threshold: 100, pass: false });
    addScore(candidate, 'doesZipCodeMatch', { value: 0, threshold: 100, pass: false });

    const result = await resolveByLastNameOnlyConsensus()(state);

    expect(mergedScore(candidate)).toMatchObject({ doesFuzzyFirstNameMatch: { pass: true } });
    expect(result.match).toBeNull();
  });

  test('does not run at all when the candidate lastName differs', async () => {
    const state = createInitialState(acmsGeoffGroshong);
    const candidate = addCandidate(
      state,
      projectTrustee(
        makeTrustee({ trusteeId: 't1', firstName: 'Geoffrey', lastName: 'Someone Else' }),
      ),
    );
    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });

    const result = await resolveByLastNameOnlyConsensus()(state);

    expect(result.candidates.get('t1')!.scores.doesFuzzyFirstNameMatch).toBeUndefined();
    expect(result.match).toBeNull();
  });

  test('does not run at all when nameScore is nonzero (a genuinely ambiguous or partial match, not this pattern)', async () => {
    const state = createInitialState(acmsGeoffGroshong);
    const candidate = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Geoffrey', lastName: 'Groshong' })),
    );
    addScore(candidate, 'doesNameMatch', { value: 85, threshold: 85, pass: true });

    const result = await resolveByLastNameOnlyConsensus()(state);

    expect(result.candidates.get('t1')!.scores.doesFuzzyFirstNameMatch).toBeUndefined();
    expect(result.match).toBeNull();
  });

  test('does not run at all when more than one sole-lastName candidate qualifies', async () => {
    const state = createInitialState(acmsGeoffGroshong);
    const first = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1', firstName: 'Geoffrey', lastName: 'Groshong' })),
    );
    addScore(first, 'doesNameMatch', { value: 0, threshold: 85, pass: false });
    const second = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't2', firstName: 'Jeff', lastName: 'Groshong' })),
    );
    addScore(second, 'doesNameMatch', { value: 0, threshold: 85, pass: false });

    const result = await resolveByLastNameOnlyConsensus()(state);

    expect(result.candidates.get('t1')!.scores.doesFuzzyFirstNameMatch).toBeUndefined();
    expect(result.candidates.get('t2')!.scores.doesFuzzyFirstNameMatch).toBeUndefined();
    expect(result.match).toBeNull();
  });
});
