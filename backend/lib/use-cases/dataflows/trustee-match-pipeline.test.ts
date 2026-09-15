import { vi } from 'vitest';
import { DxtrTrusteeParty } from '@common/cams/dataflow-events';
import { Trustee } from '@common/cams/trustees';
import {
  addCandidate,
  addScore,
  createInitialState,
  mergedScore,
  normalize,
  projectTrustee,
  runPipeline,
  Stage,
  withGuard,
} from './trustee-match-pipeline';

const makeDxtrTrustee = (overrides: Partial<DxtrTrusteeParty> = {}): DxtrTrusteeParty => ({
  fullName: 'John Doe',
  firstName: 'John',
  lastName: 'Doe',
  ...overrides,
});

const makeTrustee = (overrides: Partial<Trustee> = {}): Trustee => ({
  id: 'trustee-1',
  trusteeId: 'trustee-1',
  firstName: 'John',
  lastName: 'Doe',
  name: 'John Doe',
  status: 'active',
  public: {
    address: {
      address1: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      countryCode: 'US',
    },
  },
  createdBy: { id: 'system', name: 'System' },
  createdOn: '2024-01-01T00:00:00Z',
  updatedBy: { id: 'system', name: 'System' },
  updatedOn: '2024-01-01T00:00:00Z',
  ...overrides,
});

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

    const candidate = addCandidate(state, trustee);

    expect(state.candidates.get('t1')).toBe(candidate);
    expect(candidate.scores).toEqual([]);
  });

  test('is idempotent - proposing the same trusteeId twice returns the SAME candidate, preserving prior scores', () => {
    const state = createInitialState(makeDxtrTrustee());
    const trustee = makeTrustee({ trusteeId: 't1' });

    const first = addCandidate(state, trustee);
    addScore(first, { scorer: 'testScorer', nameScore: 100 });
    const second = addCandidate(state, trustee);

    expect(second).toBe(first);
    expect(second.scores).toEqual([{ scorer: 'testScorer', nameScore: 100 }]);
    expect(state.candidates.size).toBe(1);
  });

  test('never removes an existing candidate when a different trustee is added', () => {
    const state = createInitialState(makeDxtrTrustee());
    addCandidate(state, makeTrustee({ trusteeId: 't1' }));
    addCandidate(state, makeTrustee({ trusteeId: 't2' }));

    expect(state.candidates.size).toBe(2);
    expect(state.candidates.has('t1')).toBe(true);
    expect(state.candidates.has('t2')).toBe(true);
  });
});

describe('mergedScore', () => {
  test('returns an empty object for a candidate with no scores yet', () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, makeTrustee({ trusteeId: 't1' }));

    expect(mergedScore(candidate)).toEqual({});
  });

  test('a later score entry overrides an earlier entry for the SAME key', () => {
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, makeTrustee({ trusteeId: 't1' }));

    addScore(candidate, { scorer: 'nameScoreStage', nameScore: 0 });
    addScore(candidate, { scorer: 'nameScoreStage', nameScore: 100 });

    expect(mergedScore(candidate)).toEqual({ scorer: 'nameScoreStage', nameScore: 100 });
  });

  test('a key set by an earlier entry survives when a later entry contributes only DIFFERENT keys', () => {
    // This is the core cumulative-merge guarantee: a stage that only computes stateMismatch
    // should never need to also re-carry-forward nameScore from an earlier stage.
    const state = createInitialState(makeDxtrTrustee());
    const candidate = addCandidate(state, makeTrustee({ trusteeId: 't1' }));

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
    const candidate = addCandidate(state, makeTrustee({ trusteeId: 't1' }));
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
