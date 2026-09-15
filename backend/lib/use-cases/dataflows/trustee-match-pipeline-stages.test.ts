import { vi } from 'vitest';
import { DxtrTrusteeParty } from '@common/cams/dataflow-events';
import { Trustee } from '@common/cams/trustees';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import {
  addCandidate,
  createInitialState,
  mergedScore,
  PipelineState,
  projectTrustee,
} from './trustee-match-pipeline';
import { surnameExactDiscoveryStage, nameScoreStage } from './trustee-match-pipeline-stages';

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
    existingCandidate.scores.push({ scorer: 'earlierStage', nameScore: 42 });

    const result = await surnameExactDiscoveryStage(context)(state);

    expect(result.candidates.get('t1')!.scores).toEqual([
      { scorer: 'earlierStage', nameScore: 42 },
    ]);
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
      scorer: 'calculateNameScore',
      nameScore: 100,
    });
    expect(mergedScore(result.candidates.get('t2')!)).toMatchObject({
      scorer: 'calculateNameScore',
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

    expect(result.candidates.get('t1')!.scores).toEqual([]);
  });

  test("preserves an earlier stage's score keys via cumulative merge", async () => {
    const state = createInitialState(makeDxtrTrustee({ firstName: 'John', lastName: 'Doe' }));
    const candidate = addCandidate(
      state,
      makeTrustee({ trusteeId: 't1', firstName: 'John', lastName: 'Doe' }),
    );
    candidate.scores.push({ scorer: 'stateFilterStage', stateMismatch: false });

    const result = await nameScoreStage()(state);

    expect(mergedScore(result.candidates.get('t1')!)).toMatchObject({
      stateMismatch: false,
      nameScore: 100,
    });
  });
});
