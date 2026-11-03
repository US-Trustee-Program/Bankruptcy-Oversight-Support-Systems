import { vi, describe, test, expect, beforeEach } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { identifyTrustee, IdentifyTrusteeDeps } from './identify-trustee';
import { TrusteeVariation } from '@common/cams/trustee-variation';
import { CanonicalTrusteeSource } from '@common/cams/dataflow-events';
import { TrusteeProfessionalId } from './trustee-professional-ids.types';
import * as trusteeMatchPipelineOrchestrator from './trustee-match-pipeline-orchestrator';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { UnknownError } from '../../common-errors/unknown-error';

describe('identifyTrustee', () => {
  let context: ApplicationContext;
  let deps: IdentifyTrusteeDeps;

  const fingerprint = 'the-fingerprint';
  const variant = 'the-variant-string';
  const acmsProfessionalId = 'NY-00063';
  const source: CanonicalTrusteeSource = {
    fullName: 'John Smith',
    firstName: 'John',
    lastName: 'Smith',
  };

  const makeVariation = (overrides: Partial<TrusteeVariation> = {}): TrusteeVariation => ({
    id: 'v1',
    documentType: 'TRUSTEE_VARIATION',
    fingerprint,
    variant,
    trusteeId: 'trustee-1',
    createdOn: '2025-01-01T00:00:00.000Z',
    createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
    updatedOn: '2025-01-01T00:00:00.000Z',
    updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
    ...overrides,
  });

  const linkedProfessionalId = (
    overrides: Partial<TrusteeProfessionalId> = {},
  ): TrusteeProfessionalId => ({
    id: 'prof-id-1',
    documentType: 'TRUSTEE_PROFESSIONAL_ID',
    camsTrusteeId: 'trustee-1',
    acmsProfessionalId,
    disposition: 'linked',
    linkMethod: 'auto',
    nameMatchCount: 0,
    evidence: {
      sourceRaw: source,
      sourceNormalized: {},
      memo: {},
      candidates: [],
      match: { trusteeId: 'trustee-1', score: {}, resolvedBy: 'test' },
      skip: false,
      error: null,
    },
    createdOn: '2025-01-01T00:00:00.000Z',
    createdBy: { id: 'ACMS', name: 'ACMS' },
    updatedOn: '2025-01-01T00:00:00.000Z',
    updatedBy: { id: 'ACMS', name: 'ACMS' },
    ...overrides,
  });

  beforeEach(async () => {
    context = await createMockApplicationContext();
    deps = {
      context,
      variationRepo: factory.getTrusteeVariationRepository(context),
      professionalIdsRepo: factory.getTrusteeProfessionalIdsRepository(context),
    };
  });

  test('returns linked via fingerprint on a bucket hit, without running the pipeline', async () => {
    vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([makeVariation()]);
    vi.spyOn(deps.professionalIdsRepo, 'findByAcmsProfessionalId').mockResolvedValue([]);
    const pipelineSpy = vi.spyOn(trusteeMatchPipelineOrchestrator, 'runTrusteeMatchPipeline');

    const result = await identifyTrustee(deps, source, acmsProfessionalId, fingerprint, variant);

    expect(result).toEqual({
      kind: 'linked',
      trusteeId: 'trustee-1',
      via: 'fingerprint',
      state: expect.objectContaining({
        match: expect.objectContaining({ trusteeId: 'trustee-1' }),
      }),
    });
    expect(pipelineSpy).not.toHaveBeenCalled();
  });

  test('ignores non-matching variants in the fingerprint bucket and falls through to the pipeline', async () => {
    vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([
      makeVariation({ variant: 'a-different-variant', trusteeId: 'trustee-collision' }),
    ]);
    const pipelineSpy = vi
      .spyOn(trusteeMatchPipelineOrchestrator, 'runTrusteeMatchPipeline')
      .mockResolvedValue({
        sourceRaw: source,
        sourceNormalized: {},
        memo: new Map(),
        candidates: new Map(),
        match: null,
        skip: false,
        error: null,
      } as never);

    const result = await identifyTrustee(deps, source, acmsProfessionalId, fingerprint, variant);

    expect(result.kind).toBe('unresolved');
    expect(pipelineSpy).toHaveBeenCalled();
  });

  test('picks the exact-variant entry from a multi-entry fingerprint bucket', async () => {
    vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([
      makeVariation({ variant: 'a-different-variant', trusteeId: 'trustee-collision' }),
      makeVariation({ trusteeId: 'trustee-exact' }),
    ]);
    vi.spyOn(deps.professionalIdsRepo, 'findByAcmsProfessionalId').mockResolvedValue([]);

    const result = await identifyTrustee(deps, source, acmsProfessionalId, fingerprint, variant);

    expect(result).toMatchObject({
      kind: 'linked',
      via: 'fingerprint',
      trusteeId: 'trustee-exact',
    });
  });

  test('returns conflict via fingerprint when the matched trustee is linked to a different ACMS id record', async () => {
    vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([makeVariation()]);
    vi.spyOn(deps.professionalIdsRepo, 'findByAcmsProfessionalId').mockResolvedValue([
      linkedProfessionalId({ camsTrusteeId: 'trustee-existing' }),
    ]);

    const result = await identifyTrustee(deps, source, acmsProfessionalId, fingerprint, variant);

    expect(result).toMatchObject({
      kind: 'conflict',
      via: 'fingerprint',
      existingTrusteeId: 'trustee-existing',
    });
  });

  test('returns conflict naming the other trustee when existing links include the matched trustee and another', async () => {
    vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([makeVariation()]);
    vi.spyOn(deps.professionalIdsRepo, 'findByAcmsProfessionalId').mockResolvedValue([
      linkedProfessionalId({ camsTrusteeId: 'trustee-1' }),
      linkedProfessionalId({ id: 'prof-id-2', camsTrusteeId: 'trustee-other' }),
    ]);

    const result = await identifyTrustee(deps, source, acmsProfessionalId, fingerprint, variant);

    expect(result).toMatchObject({
      kind: 'conflict',
      via: 'fingerprint',
      existingTrusteeId: 'trustee-other',
    });
  });

  test('returns linked via name on a pipeline match when there is no fingerprint hit', async () => {
    vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
    vi.spyOn(deps.professionalIdsRepo, 'findByAcmsProfessionalId').mockResolvedValue([]);
    vi.spyOn(trusteeMatchPipelineOrchestrator, 'runTrusteeMatchPipeline').mockResolvedValue({
      sourceRaw: source,
      sourceNormalized: {},
      memo: new Map(),
      candidates: new Map(),
      match: { trusteeId: 'trustee-2', score: {}, resolvedBy: 'resolveByPhone' },
      skip: false,
      error: null,
    } as never);

    const result = await identifyTrustee(deps, source, acmsProfessionalId, fingerprint, variant);

    expect(result).toMatchObject({ kind: 'linked', via: 'name', trusteeId: 'trustee-2' });
  });

  test('returns conflict via name when the pipeline match is linked to a different ACMS id record', async () => {
    vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
    vi.spyOn(trusteeMatchPipelineOrchestrator, 'runTrusteeMatchPipeline').mockResolvedValue({
      sourceRaw: source,
      sourceNormalized: {},
      memo: new Map(),
      candidates: new Map(),
      match: { trusteeId: 'trustee-2', score: {}, resolvedBy: 'resolveByPhone' },
      skip: false,
      error: null,
    } as never);
    vi.spyOn(deps.professionalIdsRepo, 'findByAcmsProfessionalId').mockResolvedValue([
      linkedProfessionalId({ camsTrusteeId: 'trustee-existing' }),
    ]);

    const result = await identifyTrustee(deps, source, acmsProfessionalId, fingerprint, variant);

    expect(result).toMatchObject({
      kind: 'conflict',
      via: 'name',
      existingTrusteeId: 'trustee-existing',
    });
  });

  test('returns unresolved with the serialized state when the pipeline finds no match', async () => {
    vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
    vi.spyOn(trusteeMatchPipelineOrchestrator, 'runTrusteeMatchPipeline').mockResolvedValue({
      sourceRaw: source,
      sourceNormalized: {},
      memo: new Map(),
      candidates: new Map(),
      match: null,
      skip: false,
      error: null,
    } as never);

    const result = await identifyTrustee(deps, source, acmsProfessionalId, fingerprint, variant);

    expect(result.kind).toBe('unresolved');
  });

  test('rethrows a transient pipeline error rather than returning it as unresolved state', async () => {
    vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
    const transientError = new TooManyRequestsError('TEST');
    vi.spyOn(trusteeMatchPipelineOrchestrator, 'runTrusteeMatchPipeline').mockResolvedValue({
      sourceRaw: source,
      sourceNormalized: {},
      memo: new Map(),
      candidates: new Map(),
      match: null,
      skip: false,
      error: transientError,
    } as never);

    await expect(
      identifyTrustee(deps, source, acmsProfessionalId, fingerprint, variant),
    ).rejects.toBe(transientError);
  });

  test('returns a terminal pipeline error as unresolved state, not throw', async () => {
    vi.spyOn(deps.variationRepo, 'findByFingerprint').mockResolvedValue([]);
    const terminalError = new UnknownError('TEST');
    vi.spyOn(trusteeMatchPipelineOrchestrator, 'runTrusteeMatchPipeline').mockResolvedValue({
      sourceRaw: source,
      sourceNormalized: {},
      memo: new Map(),
      candidates: new Map(),
      match: null,
      skip: false,
      error: terminalError,
    } as never);

    const result = await identifyTrustee(deps, source, acmsProfessionalId, fingerprint, variant);

    expect(result).toMatchObject({
      kind: 'unresolved',
      state: {
        error: {
          message: terminalError.message,
          module: 'TEST',
          status: terminalError.status,
          originalError: terminalError.originalError,
          data: terminalError.data,
        },
      },
    });
  });
});
