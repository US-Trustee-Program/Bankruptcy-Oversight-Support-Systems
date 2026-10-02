import { vi } from 'vitest';
import { DxtrTrusteeParty } from '@common/cams/dataflow-events';
import { Trustee } from '@common/cams/trustees';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsError } from '../../common-errors/cams-error';
import {
  foldKleene,
  addCandidate,
  addScore,
  createTrusteeInitialState as createInitialState,
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

  test("seeds sourceNormalized with sourceRaw's passthrough fields, leaving address and name to be computed later", () => {
    const sourceRaw = makeDxtrTrustee({ middleName: 'Q' });
    const state = createInitialState(sourceRaw);

    expect(state.sourceNormalized).toEqual({
      firstName: 'John',
      middleName: 'Q',
      lastName: 'Doe',
      phone: undefined,
      email: undefined,
      legacy: sourceRaw.legacy,
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
      fullName: undefined,
    });
  });

  test('is idempotent - proposing the same trusteeId twice returns the SAME candidate, preserving prior scores', () => {
    const state = createInitialState(makeDxtrTrustee());
    const trustee = makeTrustee({ trusteeId: 't1' });

    const first = addCandidate(state, projectTrustee(trustee), 'test');
    addScore(first, 'doesNameMatch', { pass: true, quality: 'exact' });
    const second = addCandidate(state, projectTrustee(trustee), 'test');

    expect(second).toBe(first);
    expect(second.scores).toEqual({
      doesNameMatch: { pass: true, quality: 'exact' },
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
  // Models a stage that runs its own nested pipeline, then promotes only the survivors into the
  // outer state.
  test('merges a candidate built by a nested pipeline run into the outer state, preserving its score history', () => {
    const innerState = createInitialState(makeDxtrTrustee());
    const innerCandidate = addCandidate(
      innerState,
      projectTrustee(makeTrustee({ trusteeId: 't1' })),
      'test',
    );
    addScore(innerCandidate, 'doesNameMatch', { pass: true, quality: 'exact' });

    const outerState = createInitialState(makeDxtrTrustee());
    const promoted = promoteCandidate(outerState, innerCandidate);

    expect(outerState.candidates.get('t1')).toBe(promoted);
    expect(promoted.scores).toEqual({
      doesNameMatch: { pass: true, quality: 'exact' },
    });
  });

  test('is idempotent - promoting a trusteeId already present in the outer state returns the OUTER entry unchanged', () => {
    const outerState = createInitialState(makeDxtrTrustee());
    const outerCandidate = addCandidate(
      outerState,
      projectTrustee(makeTrustee({ trusteeId: 't1' })),
      'test',
    );
    addScore(outerCandidate, 'doesNameMatch', { pass: false });

    const innerState = createInitialState(makeDxtrTrustee());
    const innerCandidate = addCandidate(
      innerState,
      projectTrustee(makeTrustee({ trusteeId: 't1' })),
      'test',
    );
    addScore(innerCandidate, 'doesNameMatch', { pass: true, quality: 'exact' });

    const result = promoteCandidate(outerState, innerCandidate);

    expect(result).toBe(outerCandidate);
    expect(result.scores).toEqual({
      doesNameMatch: { pass: false },
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

describe('addScore', () => {
  test('overwrites an earlier result recorded under the same scorer name', () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })), 'test');

    addScore(candidate, 'doesNameMatch', { pass: false, quality: 'strong' });
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'exact' });

    expect(candidate.scores).toEqual({
      doesNameMatch: { pass: true, quality: 'exact' },
    });
  });

  test('keeps results recorded under different scorer names side by side', () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })), 'test');

    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'exact' });
    addScore(candidate, 'doesStateMatch', { pass: false });

    expect(candidate.scores).toEqual({
      doesNameMatch: { pass: true, quality: 'exact' },
      doesStateMatch: { pass: false },
    });
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

  // runPipeline is the only place that checks for a terminal outcome; stages never do.
  test('stops iterating and returns immediately once a stage sets match, never calling any later stage', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const matchingStage: Stage = async (s) => ({
      ...s,
      match: {
        trusteeId: 't1',
        score: { doesNameMatch: { pass: true, quality: 'exact' } },
        resolvedBy: 'matchingStage',
      },
    });
    const laterStage = vi.fn(async (s) => ({
      ...s,
      error: new CamsError('TEST', { message: 'should-not-run' }),
    }));

    const result = await runPipeline(state, [matchingStage, laterStage]);

    expect(laterStage).not.toHaveBeenCalled();
    expect(result.match).toEqual({
      trusteeId: 't1',
      score: { doesNameMatch: { pass: true, quality: 'exact' } },
      resolvedBy: 'matchingStage',
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
    addScore(candidate, 'doesNameMatch', { pass: true, quality: 'exact' });

    const serialized = serializeState(state);
    const roundTripped = JSON.parse(JSON.stringify(serialized));

    expect(roundTripped).toEqual({
      sourceRaw: state.sourceRaw,
      sourceNormalized: {
        firstName: 'John',
        lastName: 'Doe',
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
            email: candidate.camsRaw.email,
            phone: candidate.camsRaw.phone,
            name: 'john doe',
          },
          memo: { lastNameToken: [{ key: 'John Doe', value: 'doe' }] },
          scores: { doesNameMatch: { pass: true, quality: 'exact' } },
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
      match: {
        trusteeId: 't1',
        score: { doesNameMatch: { pass: true, quality: 'exact' } },
        resolvedBy: 'resolveByNameOnly',
      },
    };

    const serialized = serializeState(state);

    expect(serialized.match).toEqual({
      trusteeId: 't1',
      score: { doesNameMatch: { pass: true, quality: 'exact' } },
      resolvedBy: 'resolveByNameOnly',
    });
  });

  test('serializes an empty candidate map as an empty array', () => {
    const state = createInitialState(makeDxtrTrustee());

    const serialized = serializeState(state);

    expect(serialized.candidates).toEqual([]);
  });
});

describe('foldKleene', () => {
  test.each([
    { value: null, expected: 'neutral' },
    { value: true, expected: 'agreement' },
    { value: false, expected: 'conflict' },
  ])('runs only the $expected branch for $value', ({ value, expected }) => {
    expect(
      foldKleene(
        value,
        () => 'neutral',
        () => 'agreement',
        () => 'conflict',
      ),
    ).toBe(expected);
  });
});
