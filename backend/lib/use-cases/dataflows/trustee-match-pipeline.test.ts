import { vi } from 'vitest';
import { DxtrTrusteeParty } from '@common/cams/dataflow-events';
import { Trustee } from '@common/cams/trustees';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsError } from '../../common-errors/cams-error';
import {
  addCandidate,
  addDisqualifier,
  addScore,
  createTrusteeInitialState as createInitialState,
  mergedScore,
  normalize,
  NormalizedMemo,
  TrusteePipelineState as PipelineState,
  projectTrustee,
  promoteCandidate,
  runPipeline,
  serializeState,
  TrusteeStage as Stage,
} from './trustee-match-pipeline';

const makeDxtrTrustee = (overrides: Partial<DxtrTrusteeParty> = {}): DxtrTrusteeParty => ({
  fullName: 'John Doe',
  firstName: 'John',
  lastName: 'Doe',
  ...overrides,
});

const makeTrustee = (overrides: Partial<Trustee> = {}): Trustee =>
  MockData.getTrustee({ firstName: 'John', lastName: 'Doe', ...overrides });

describe('projectTrustee', () => {
  test('projects only the matching-relevant fields off a full Trustee', () => {
    const trustee = makeTrustee({
      trusteeId: 't1',
      firstName: 'Jane',
      middleName: 'Q',
      lastName: 'Smith',
      name: 'Jane Q. Smith',
    });

    const projected = projectTrustee(trustee);

    expect(projected).toEqual({
      trusteeId: 't1',
      firstName: 'Jane',
      middleName: 'Q',
      lastName: 'Smith',
      name: 'Jane Q. Smith',
      address: trustee.public.address,
      phone: trustee.public.phone,
      email: trustee.public.email,
    });
  });
});

describe('createInitialState', () => {
  test('starts with no candidates, no match, not skipped, no error', () => {
    const sourceRaw = makeDxtrTrustee();

    const state = createInitialState(sourceRaw);

    expect(state.sourceRaw).toBe(sourceRaw);
    expect(state.candidates.size).toBe(0);
    expect(state.match).toBeNull();
    expect(state.skip).toBe(false);
    expect(state.error).toBeNull();
  });

  test("starts as a clone of sourceRaw's scalar name fields, excluding address/name (reshaped, not passthrough, fields)", () => {
    const sourceRaw = makeDxtrTrustee({ middleName: 'Q' });
    const state = createInitialState(sourceRaw);

    expect(state.sourceNormalized).toEqual({
      firstName: 'John',
      middleName: 'Q',
      lastName: 'Doe',
      phone: undefined,
      email: undefined,
      legacy: sourceRaw.legacy,
      legacyLastName: 'Doe',
      fullName: sourceRaw.fullName,
    });
  });
});

describe('addCandidate', () => {
  test('adds a new candidate keyed by trusteeId with an empty score history', () => {
    const state = createInitialState(makeDxtrTrustee());
    const trustee = makeTrustee({ trusteeId: 't1' });

    const candidate = addCandidate(state, projectTrustee(trustee), 'test');

    expect(state.candidates.get('t1')).toBe(candidate);
    expect(candidate.scores).toEqual({});
  });

  test("starts as a clone of camsRaw's scalar name/contact fields, excluding address/name (reshaped, not passthrough, fields)", () => {
    const state = createInitialState(makeDxtrTrustee());
    const trustee = makeTrustee({
      trusteeId: 't1',
      firstName: 'Jane',
      middleName: 'Q',
      lastName: 'Smith',
    });

    const candidate = addCandidate(state, projectTrustee(trustee), 'test');
    const projected = projectTrustee(trustee);

    expect(candidate.camsNormalized).toEqual({
      firstName: 'Jane',
      middleName: 'Q',
      lastName: 'Smith',
      phone: projected.phone,
      email: projected.email,
      legacy: undefined,
      legacyLastName: 'Smith',
      fullName: undefined,
    });
  });

  test('is idempotent - proposing the same trusteeId twice returns the SAME candidate, preserving prior scores', () => {
    const state = createInitialState(makeDxtrTrustee());
    const trustee = makeTrustee({ trusteeId: 't1' });

    const first = addCandidate(state, projectTrustee(trustee), 'test');
    addScore(first, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    const second = addCandidate(state, projectTrustee(trustee), 'test');

    expect(second).toBe(first);
    expect(second.scores).toEqual({
      doesNameMatch: { value: 100, threshold: 85, pass: true },
    });
    expect(state.candidates.size).toBe(1);
  });

  test('never removes an existing candidate when a different trustee is added', () => {
    const state = createInitialState(makeDxtrTrustee());
    addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })), 'test');
    addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't2' })), 'test');

    expect(state.candidates.size).toBe(2);
    expect(state.candidates.has('t1')).toBe(true);
    expect(state.candidates.has('t2')).toBe(true);
  });
});

describe('promoteCandidate', () => {
  // Models the nested-pipeline pattern (see
  // docs/architecture/decision-records/TrusteeMatchingPipeline.md): a stage runs its own scoped
  // discovery-then-filter pipeline internally, then promotes only the survivors into the outer
  // state - carrying the inner pipeline's own score history forward rather than discarding it.
  test('merges a candidate built by a nested pipeline run into the outer state, preserving its score history', () => {
    const innerState = createInitialState(makeDxtrTrustee());
    const innerCandidate = addCandidate(
      innerState,
      projectTrustee(makeTrustee({ trusteeId: 't1' })),
      'test',
    );
    addScore(innerCandidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });

    const outerState = createInitialState(makeDxtrTrustee());
    const promoted = promoteCandidate(outerState, innerCandidate);

    expect(outerState.candidates.get('t1')).toBe(promoted);
    expect(promoted.scores).toEqual({
      doesNameMatch: { value: 100, threshold: 85, pass: true },
    });
  });

  test('is idempotent - promoting a trusteeId already present in the outer state returns the OUTER entry unchanged', () => {
    const outerState = createInitialState(makeDxtrTrustee());
    const outerCandidate = addCandidate(
      outerState,
      projectTrustee(makeTrustee({ trusteeId: 't1' })),
      'test',
    );
    addScore(outerCandidate, 'doesNameMatch', { value: 50, threshold: 85, pass: false });

    const innerState = createInitialState(makeDxtrTrustee());
    const innerCandidate = addCandidate(
      innerState,
      projectTrustee(makeTrustee({ trusteeId: 't1' })),
      'test',
    );
    addScore(innerCandidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });

    const result = promoteCandidate(outerState, innerCandidate);

    expect(result).toBe(outerCandidate);
    expect(result.scores).toEqual({
      doesNameMatch: { value: 50, threshold: 85, pass: false },
    });
  });

  test('never removes an existing outer candidate when a different candidate is promoted', () => {
    const outerState = createInitialState(makeDxtrTrustee());
    addCandidate(outerState, projectTrustee(makeTrustee({ trusteeId: 't1' })), 'test');

    const innerState = createInitialState(makeDxtrTrustee());
    const innerCandidate = addCandidate(
      innerState,
      projectTrustee(makeTrustee({ trusteeId: 't2' })),
      'test',
    );

    promoteCandidate(outerState, innerCandidate);

    expect(outerState.candidates.size).toBe(2);
    expect(outerState.candidates.has('t1')).toBe(true);
    expect(outerState.candidates.has('t2')).toBe(true);
  });
});

describe('mergedScore', () => {
  test('returns an empty object for a candidate with no scores yet', () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })), 'test');

    expect(mergedScore(candidate)).toEqual({});
  });

  test('a later write to the SAME scorer overwrites its prior slot', () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })), 'test');

    addScore(candidate, 'doesNameMatch', { value: 0, threshold: 85, pass: false });
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });

    expect(mergedScore(candidate)).toEqual({
      doesNameMatch: { value: 100, threshold: 85, pass: true },
    });
  });

  test('a key set by one scorer survives when a different scorer contributes a different key', () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })), 'test');

    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });
    addScore(candidate, 'isStateNotConflicting', { value: 0, threshold: 100, pass: false });

    expect(mergedScore(candidate)).toEqual({
      doesNameMatch: { value: 100, threshold: 85, pass: true },
      isStateNotConflicting: { value: 0, threshold: 100, pass: false },
    });
  });

  test('does not mutate the underlying scores map', () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })), 'test');
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });

    mergedScore(candidate);

    expect(candidate.scores).toEqual({
      doesNameMatch: { value: 100, threshold: 85, pass: true },
    });
  });
});

describe('addDisqualifier', () => {
  test('a new candidate starts with no disqualifiers', () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })), 'test');

    expect(candidate.disqualifiers).toEqual([]);
  });

  test('records a scorer, reason, and the specific evidence compared', () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })), 'test');

    addDisqualifier(candidate, 'doesCityMatch', 'city actively disagrees', {
      acmsCity: 'Sonoma',
      camsCity: 'San Francisco',
    });

    expect(candidate.disqualifiers).toEqual([
      {
        scorer: 'doesCityMatch',
        reason: 'city actively disagrees',
        evidence: { acmsCity: 'Sonoma', camsCity: 'San Francisco' },
      },
    ]);
  });

  test('appends rather than overwrites - more than one scorer can disqualify the same candidate', () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })), 'test');

    addDisqualifier(candidate, 'doesCityMatch', 'city actively disagrees', {
      acmsCity: 'Sonoma',
      camsCity: 'San Francisco',
    });
    addDisqualifier(candidate, 'doesZipCodeMatch', 'zip actively disagrees', {
      acmsZip: '95476',
      camsZip: '94111',
    });

    expect(candidate.disqualifiers).toEqual([
      {
        scorer: 'doesCityMatch',
        reason: 'city actively disagrees',
        evidence: { acmsCity: 'Sonoma', camsCity: 'San Francisco' },
      },
      {
        scorer: 'doesZipCodeMatch',
        reason: 'zip actively disagrees',
        evidence: { acmsZip: '95476', camsZip: '94111' },
      },
    ]);
  });

  test('does not affect a different candidate in the same state', () => {
    const state = createInitialState(makeDxtrTrustee());
    const disqualified = addCandidate(
      state,
      projectTrustee(makeTrustee({ trusteeId: 't1' })),
      'test',
    );
    const untouched = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't2' })), 'test');

    addDisqualifier(disqualified, 'doesCityMatch', 'city actively disagrees', {});

    expect(untouched.disqualifiers).toEqual([]);
  });
});

describe('normalize', () => {
  test('computes and caches a value under the given function name and fingerprint on first access', () => {
    const memo: NormalizedMemo = new Map();
    const compute = vi.fn(() => 'computed-value');

    const result = normalize(memo, 'someFunction', 'someFingerprint', compute);

    expect(result).toBe('computed-value');
    expect(compute).toHaveBeenCalledTimes(1);
    expect(memo.get('someFunction')).toEqual([{ key: 'someFingerprint', value: 'computed-value' }]);
  });

  test('returns the cached value on a second access with the SAME fingerprint WITHOUT recomputing', () => {
    const memo: NormalizedMemo = new Map();
    const compute = vi.fn(() => 'computed-value');

    normalize(memo, 'someFunction', 'someFingerprint', compute);
    const second = normalize(memo, 'someFunction', 'someFingerprint', compute);

    expect(second).toBe('computed-value');
    expect(compute).toHaveBeenCalledTimes(1);
  });

  test('a DIFFERENT fingerprint under the SAME function name is computed and cached independently - no collision', () => {
    const memo: NormalizedMemo = new Map();

    const a = normalize(memo, 'someFunction', 'fingerprint-a', () => 'value-a');
    const b = normalize(memo, 'someFunction', 'fingerprint-b', () => 'value-b');

    expect(a).toBe('value-a');
    expect(b).toBe('value-b');
    expect(memo.get('someFunction')).toEqual([
      { key: 'fingerprint-a', value: 'value-a' },
      { key: 'fingerprint-b', value: 'value-b' },
    ]);
  });

  test('different function names on the same memo are computed and cached independently', () => {
    const memo: NormalizedMemo = new Map();

    const a = normalize(memo, 'functionA', 'someFingerprint', () => 'value-a');
    const b = normalize(memo, 'functionB', 'someFingerprint', () => 'value-b');

    expect(a).toBe('value-a');
    expect(b).toBe('value-b');
  });
});

describe('runPipeline', () => {
  test('runs stages in order, threading the returned state through each', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const calls: string[] = [];
    const stageA: Stage = async (s) => {
      calls.push('A');
      return { ...s };
    };
    const stageB: Stage = async (s) => {
      calls.push('B');
      return { ...s };
    };

    const result = await runPipeline(state, [stageA, stageB]);

    expect(calls).toEqual(['A', 'B']);
    expect(result.error).toBeNull();
  });

  test('returns the initial state unchanged when given an empty stage list', async () => {
    const state = createInitialState(makeDxtrTrustee());

    const result = await runPipeline(state, []);

    expect(result).toBe(state);
  });

  // runPipeline is the SOLE place that checks for a terminal outcome (see its own doc comment) -
  // no individual stage performs this check itself, so a stage can be written as a plain, pure
  // state -> state function with zero control-flow responsibility of its own.
  test('stops iterating and returns immediately once a stage sets match, never calling any later stage', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const matchingStage: Stage = async (s) => ({
      ...s,
      match: { trusteeId: 't1', score: { nameScore: 100, nameMatchQuality: 'exact' } },
    });
    const laterStage = vi.fn(async (s) => ({
      ...s,
      error: new CamsError('TEST', { message: 'should-not-run' }),
    }));

    const result = await runPipeline(state, [matchingStage, laterStage]);

    expect(laterStage).not.toHaveBeenCalled();
    expect(result.match).toEqual({
      trusteeId: 't1',
      score: { nameScore: 100, nameMatchQuality: 'exact' },
    });
    expect(result.error).toBeNull();
  });

  test('stops iterating once a stage sets skip, never calling any later stage', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const skippingStage: Stage = async (s) => ({ ...s, skip: true });
    const laterStage = vi.fn(async (s) => ({
      ...s,
      error: new CamsError('TEST', { message: 'should-not-run' }),
    }));

    const result = await runPipeline(state, [skippingStage, laterStage]);

    expect(laterStage).not.toHaveBeenCalled();
    expect(result.skip).toBe(true);
    expect(result.error).toBeNull();
  });

  test('stops iterating once a stage sets error, never calling any later stage', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const erroringStage: Stage = async (s) => ({
      ...s,
      error: new CamsError('TEST', { message: 'from-A' }),
    });
    const laterStage = vi.fn(async (s) => ({
      ...s,
      error: new CamsError('TEST', { message: 'should-not-run' }),
    }));

    const result = await runPipeline(state, [erroringStage, laterStage]);

    expect(laterStage).not.toHaveBeenCalled();
    expect(result.error?.message).toBe('from-A');
  });

  test('never even invokes the first stage when the initial state is already terminal', async () => {
    const state: PipelineState = { ...createInitialState(makeDxtrTrustee()), skip: true };
    const firstStage = vi.fn(async (s) => ({
      ...s,
      error: new CamsError('TEST', { message: 'should-not-run' }),
    }));

    const result = await runPipeline(state, [firstStage]);

    expect(firstStage).not.toHaveBeenCalled();
    expect(result).toBe(state);
  });
});

describe('serializeState', () => {
  test('produces a JSON.stringify-safe plain object - Maps become plain objects/arrays', () => {
    const state = createInitialState(makeDxtrTrustee());
    state.sourceNormalized.name = 'john doe';
    normalize(state.memo, 'lastNameToken', 'John Doe', () => 'doe');
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })), 'test');
    candidate.camsNormalized.name = 'john doe';
    normalize(candidate.memo, 'lastNameToken', 'John Doe', () => 'doe');
    addScore(candidate, 'doesNameMatch', { value: 100, threshold: 85, pass: true });

    const serialized = serializeState(state);
    const roundTripped = JSON.parse(JSON.stringify(serialized));

    expect(roundTripped).toEqual({
      sourceRaw: state.sourceRaw,
      sourceNormalized: {
        firstName: 'John',
        lastName: 'Doe',
        legacyLastName: 'Doe',
        fullName: 'John Doe',
        name: 'john doe',
      },
      memo: { lastNameToken: [{ key: 'John Doe', value: 'doe' }] },
      candidates: [
        {
          camsRaw: candidate.camsRaw,
          camsNormalized: {
            firstName: 'John',
            lastName: 'Doe',
            legacyLastName: 'Doe',
            email: candidate.camsRaw.email,
            phone: candidate.camsRaw.phone,
            name: 'john doe',
          },
          memo: { lastNameToken: [{ key: 'John Doe', value: 'doe' }] },
          scores: { doesNameMatch: { value: 100, threshold: 85, pass: true } },
          disqualifiers: [],
          origin: 'test',
        },
      ],
      match: null,
      skip: false,
      error: null,
    });
  });

  test('serializes a resolved match and its score', () => {
    const state: PipelineState = {
      ...createInitialState(makeDxtrTrustee()),
      match: { trusteeId: 't1', score: { nameScore: 100, nameMatchQuality: 'exact' } },
    };

    const serialized = serializeState(state);

    expect(serialized.match).toEqual({
      trusteeId: 't1',
      score: { nameScore: 100, nameMatchQuality: 'exact' },
    });
  });

  test('serializes an empty candidate map as an empty array', () => {
    const state = createInitialState(makeDxtrTrustee());

    const serialized = serializeState(state);

    expect(serialized.candidates).toEqual([]);
  });
});
