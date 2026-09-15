import { vi } from 'vitest';
import { DxtrTrusteeParty } from '@common/cams/dataflow-events';
import { Trustee } from '@common/cams/trustees';
import MockData from '@common/cams/test-utilities/mock-data';
import {
  addCandidate,
  addScore,
  createInitialState,
  mergedScore,
  normalize,
  PipelineState,
  projectTrustee,
  promoteCandidate,
  runPipeline,
  serializeState,
  Stage,
  withGuard,
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
    });
  });
});

describe('createInitialState', () => {
  test('starts with no candidates, no match, not skipped, no error', () => {
    const acmsRaw = makeDxtrTrustee();

    const state = createInitialState(acmsRaw);

    expect(state.acmsRaw).toBe(acmsRaw);
    expect(state.candidates.size).toBe(0);
    expect(state.match).toBeNull();
    expect(state.skip).toBe(false);
    expect(state.error).toBeNull();
  });
});

describe('addCandidate', () => {
  test('adds a new candidate keyed by trusteeId with an empty score history', () => {
    const state = createInitialState(makeDxtrTrustee());
    const trustee = makeTrustee({ trusteeId: 't1' });

    const candidate = addCandidate(state, projectTrustee(trustee));

    expect(state.candidates.get('t1')).toBe(candidate);
    expect(candidate.scores).toEqual([]);
  });

  test('is idempotent - proposing the same trusteeId twice returns the SAME candidate, preserving prior scores', () => {
    const state = createInitialState(makeDxtrTrustee());
    const trustee = makeTrustee({ trusteeId: 't1' });

    const first = addCandidate(state, projectTrustee(trustee));
    addScore(first, { scorer: 'testScorer', nameScore: 100 });
    const second = addCandidate(state, projectTrustee(trustee));

    expect(second).toBe(first);
    expect(second.scores).toEqual([{ scorer: 'testScorer', nameScore: 100 }]);
    expect(state.candidates.size).toBe(1);
  });

  test('never removes an existing candidate when a different trustee is added', () => {
    const state = createInitialState(makeDxtrTrustee());
    addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));
    addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't2' })));

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
    );
    addScore(innerCandidate, { scorer: 'innerTierScorer', nameScore: 100 });

    const outerState = createInitialState(makeDxtrTrustee());
    const promoted = promoteCandidate(outerState, innerCandidate);

    expect(outerState.candidates.get('t1')).toBe(promoted);
    expect(promoted.scores).toEqual([{ scorer: 'innerTierScorer', nameScore: 100 }]);
  });

  test('is idempotent - promoting a trusteeId already present in the outer state returns the OUTER entry unchanged', () => {
    const outerState = createInitialState(makeDxtrTrustee());
    const outerCandidate = addCandidate(
      outerState,
      projectTrustee(makeTrustee({ trusteeId: 't1' })),
    );
    addScore(outerCandidate, { scorer: 'outerStage', nameScore: 50 });

    const innerState = createInitialState(makeDxtrTrustee());
    const innerCandidate = addCandidate(
      innerState,
      projectTrustee(makeTrustee({ trusteeId: 't1' })),
    );
    addScore(innerCandidate, { scorer: 'innerTierScorer', nameScore: 100 });

    const result = promoteCandidate(outerState, innerCandidate);

    expect(result).toBe(outerCandidate);
    expect(result.scores).toEqual([{ scorer: 'outerStage', nameScore: 50 }]);
  });

  test('never removes an existing outer candidate when a different candidate is promoted', () => {
    const outerState = createInitialState(makeDxtrTrustee());
    addCandidate(outerState, projectTrustee(makeTrustee({ trusteeId: 't1' })));

    const innerState = createInitialState(makeDxtrTrustee());
    const innerCandidate = addCandidate(
      innerState,
      projectTrustee(makeTrustee({ trusteeId: 't2' })),
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
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));

    expect(mergedScore(candidate)).toEqual({});
  });

  test('a later score entry overrides an earlier entry for the SAME key', () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));

    addScore(candidate, { scorer: 'nameScoreStage', nameScore: 0 });
    addScore(candidate, { scorer: 'nameScoreStage', nameScore: 100 });

    expect(mergedScore(candidate)).toEqual({ scorer: 'nameScoreStage', nameScore: 100 });
  });

  test('a key set by an earlier entry survives when a later entry contributes only DIFFERENT keys', () => {
    // This is the core cumulative-merge guarantee: a stage that only computes stateMismatch
    // should never need to also re-carry-forward nameScore from an earlier stage.
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));

    addScore(candidate, { scorer: 'nameScoreStage', nameScore: 100 });
    addScore(candidate, { scorer: 'stateFilterStage', stateMismatch: true });

    expect(mergedScore(candidate)).toEqual({
      scorer: 'stateFilterStage',
      nameScore: 100,
      stateMismatch: true,
    });
  });

  test('does not mutate the underlying scores array', () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));
    addScore(candidate, { scorer: 'nameScoreStage', nameScore: 100 });

    mergedScore(candidate);

    expect(candidate.scores).toEqual([{ scorer: 'nameScoreStage', nameScore: 100 }]);
  });
});

describe('normalize', () => {
  test('computes and caches a value under the given key on first access', () => {
    const memo = new Map<string, unknown>();
    const compute = vi.fn(() => 'computed-value');

    const result = normalize(memo, 'someKey', compute);

    expect(result).toBe('computed-value');
    expect(compute).toHaveBeenCalledTimes(1);
  });

  test('returns the cached value on a second access WITHOUT recomputing', () => {
    const memo = new Map<string, unknown>();
    const compute = vi.fn(() => 'computed-value');

    normalize(memo, 'someKey', compute);
    const second = normalize(memo, 'someKey', compute);

    expect(second).toBe('computed-value');
    expect(compute).toHaveBeenCalledTimes(1);
  });

  test('different keys on the same memo are computed and cached independently', () => {
    const memo = new Map<string, unknown>();

    const a = normalize(memo, 'keyA', () => 'value-a');
    const b = normalize(memo, 'keyB', () => 'value-b');

    expect(a).toBe('value-a');
    expect(b).toBe('value-b');
  });
});

describe('withGuard', () => {
  test('runs the wrapped stage when match and skip are both unset', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const inner = vi.fn(async (s) => ({ ...s, error: 'ran' }));

    const guarded = withGuard(inner);
    const result = await guarded(state);

    expect(inner).toHaveBeenCalledWith(state);
    expect(result.error).toBe('ran');
  });

  test('no-ops without calling the wrapped stage once match is set', async () => {
    const state = {
      ...createInitialState(makeDxtrTrustee()),
      match: { trusteeId: 't1', score: {} },
    };
    const inner = vi.fn(async (s) => ({ ...s, error: 'ran' }));

    const result = await withGuard(inner)(state);

    expect(inner).not.toHaveBeenCalled();
    expect(result).toBe(state);
  });

  test('no-ops without calling the wrapped stage once skip is set', async () => {
    const state = { ...createInitialState(makeDxtrTrustee()), skip: true };
    const inner = vi.fn(async (s) => ({ ...s, error: 'ran' }));

    const result = await withGuard(inner)(state);

    expect(inner).not.toHaveBeenCalled();
    expect(result).toBe(state);
  });
});

describe('runPipeline', () => {
  test('runs stages in order, threading the returned state through each', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const calls: string[] = [];
    const stageA: Stage = async (s) => {
      calls.push('A');
      return { ...s, error: 'from-A' };
    };
    const stageB: Stage = async (s) => {
      calls.push('B');
      expect(s.error).toBe('from-A');
      return { ...s, error: 'from-B' };
    };

    const result = await runPipeline(state, [stageA, stageB]);

    expect(calls).toEqual(['A', 'B']);
    expect(result.error).toBe('from-B');
  });

  test('returns the initial state unchanged when given an empty stage list', async () => {
    const state = createInitialState(makeDxtrTrustee());

    const result = await runPipeline(state, []);

    expect(result).toBe(state);
  });

  test('a later stage guarded with withGuard never runs once an earlier stage sets match', async () => {
    const state = createInitialState(makeDxtrTrustee());
    const matchingStage: Stage = async (s) => ({
      ...s,
      match: { trusteeId: 't1', score: { nameScore: 100 } },
    });
    const laterStage = vi.fn(async (s) => ({ ...s, error: 'should-not-run' }));

    const result = await runPipeline(state, [matchingStage, withGuard(laterStage)]);

    expect(laterStage).not.toHaveBeenCalled();
    expect(result.match).toEqual({ trusteeId: 't1', score: { nameScore: 100 } });
    expect(result.error).toBeNull();
  });
});

describe('serializeState', () => {
  test('produces a JSON.stringify-safe plain object - Maps become plain objects/arrays', () => {
    const state = createInitialState(makeDxtrTrustee());
    normalize(state.acmsNormalized, 'lastNameToken', () => 'doe');
    const candidate = addCandidate(state, projectTrustee(makeTrustee({ trusteeId: 't1' })));
    normalize(candidate.camsNormalized, 'lastNameToken', () => 'doe');
    addScore(candidate, { scorer: 'nameScoreStage', nameScore: 100 });

    const serialized = serializeState(state);
    const roundTripped = JSON.parse(JSON.stringify(serialized));

    expect(roundTripped).toEqual({
      acmsRaw: state.acmsRaw,
      acmsNormalized: { lastNameToken: 'doe' },
      candidates: [
        {
          camsRaw: candidate.camsRaw,
          camsNormalized: { lastNameToken: 'doe' },
          scores: [{ scorer: 'nameScoreStage', nameScore: 100 }],
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
      match: { trusteeId: 't1', score: { nameScore: 100 } },
    };

    const serialized = serializeState(state);

    expect(serialized.match).toEqual({ trusteeId: 't1', score: { nameScore: 100 } });
  });

  test('serializes an empty candidate map as an empty array', () => {
    const state = createInitialState(makeDxtrTrustee());

    const serialized = serializeState(state);

    expect(serialized.candidates).toEqual([]);
  });
});
