import { vi, describe, test, expect, beforeEach } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { upsertIdentityTask, UpsertIdentityTaskInput } from './identity-task';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { TrusteeMatchVerificationRepository } from '../gateways.types';

describe('upsertIdentityTask', () => {
  let context: ApplicationContext;
  let verificationRepo: TrusteeMatchVerificationRepository;

  const findings: TrusteeMatchVerification['findings'] = {
    sourceRaw: { fullName: 'Jane Doe' },
    sourceNormalized: {},
    memo: {},
    candidates: [],
    match: null,
    skip: false,
    error: null,
  };

  const baseInput: UpsertIdentityTaskInput = {
    source: 'ACMS',
    sourceTrustee: { fullName: 'Jane Doe' },
    mismatchReason: 'ambiguous',
    findings,
    fingerprint: 'fp-abc123',
    variant: '{"fullName":"jane doe"}',
    acmsProfessionalId: 'NY-00123',
  };

  const makeExisting = (
    overrides: Partial<TrusteeMatchVerification> = {},
  ): TrusteeMatchVerification => ({
    id: 'existing-id',
    documentType: 'TRUSTEE_MATCH_VERIFICATION',
    caseId: '081-22-11111',
    courtId: '0881',
    sourceTrustee: { fullName: 'Jane Doe' },
    mismatchReason: 'ambiguous',
    source: 'DXTR',
    findings,
    status: 'pending',
    taskType: 'trustee-match',
    fingerprint: baseInput.fingerprint,
    variant: baseInput.variant,
    createdOn: '2025-01-01T00:00:00.000Z',
    createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
    updatedOn: '2025-01-01T00:00:00.000Z',
    updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
    ...overrides,
  });

  beforeEach(async () => {
    context = await createMockApplicationContext();
    verificationRepo = factory.getTrusteeMatchVerificationRepository(context);
  });

  test('writes a new caseless task when no bucket entry exists', async () => {
    vi.spyOn(verificationRepo, 'findByFingerprint').mockResolvedValue([]);
    const upsertSpy = vi
      .spyOn(verificationRepo, 'upsertVerification')
      .mockResolvedValue(undefined as never);

    const isReVerification = await upsertIdentityTask(verificationRepo, baseInput);

    expect(isReVerification).toBe(false);
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'ACMS',
        sourceTrustee: { fullName: 'Jane Doe' },
        mismatchReason: 'ambiguous',
        acmsProfessionalId: 'NY-00123',
        status: 'pending',
        taskType: 'trustee-match',
        fingerprint: baseInput.fingerprint,
        variant: baseInput.variant,
        caseId: undefined,
        courtId: undefined,
        appointedDate: undefined,
      }),
    );
  });

  test('writes a new task with case fields when the source provides them', async () => {
    vi.spyOn(verificationRepo, 'findByFingerprint').mockResolvedValue([]);
    const upsertSpy = vi
      .spyOn(verificationRepo, 'upsertVerification')
      .mockResolvedValue(undefined as never);

    await upsertIdentityTask(verificationRepo, {
      ...baseInput,
      source: 'DXTR',
      acmsProfessionalId: undefined,
      caseId: '081-22-11111',
      courtId: '0881',
      appointedDate: '2025-03-01T00:00:00.000Z',
    });

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: '081-22-11111',
        courtId: '0881',
        appointedDate: '2025-03-01T00:00:00.000Z',
      }),
    );
  });

  test('merges into an existing pending task rather than creating a second one', async () => {
    const existing = makeExisting();
    vi.spyOn(verificationRepo, 'findByFingerprint').mockResolvedValue([existing]);
    const upsertSpy = vi
      .spyOn(verificationRepo, 'upsertVerification')
      .mockResolvedValue(undefined as never);

    const isReVerification = await upsertIdentityTask(verificationRepo, baseInput);

    expect(isReVerification).toBe(false);
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'existing-id',
        source: 'ACMS',
        mismatchReason: 'ambiguous',
      }),
    );
  });

  test('leaves a resolved task untouched and reports a re-verification', async () => {
    const resolved = makeExisting({ status: 'approved' });
    vi.spyOn(verificationRepo, 'findByFingerprint').mockResolvedValue([resolved]);
    const upsertSpy = vi.spyOn(verificationRepo, 'upsertVerification');

    const isReVerification = await upsertIdentityTask(verificationRepo, baseInput);

    expect(isReVerification).toBe(true);
    expect(upsertSpy).not.toHaveBeenCalled();
  });
});
