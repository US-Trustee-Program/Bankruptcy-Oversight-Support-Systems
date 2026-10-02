import { describe, test, expect, vi, beforeEach, Mock } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as DataflowTelemetry from '../../lib/use-cases/dataflows/dataflow-telemetry';
import { TooManyRequestsError } from '../../lib/common-errors/too-many-requests-error';
import { StorageQueueHumbleObject } from '../../lib/humble-objects/storage-queue-humble';
import ApplicationContextCreator from '../azure/application-context-creator';
import { createMockApplicationContext } from '../../lib/testing/testing-utilities';
import factory from '../../lib/factory';
import TrusteeVerificationRemapUseCase from '../../lib/use-cases/dataflows/trustee-verification-remap';
import { TrusteeVerificationRemapMessage } from '@common/cams/dataflow-events';
import { MockMongoRepository } from '../../lib/testing/mock-gateways/mock-mongo.repository';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'trustee-verification-remap',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

const makeMessage = (
  overrides: Partial<TrusteeVerificationRemapMessage> = {},
): TrusteeVerificationRemapMessage => ({
  fingerprint: 'fp-abc123',
  resolvedTrusteeId: 'trustee-new',
  resolvedTrusteeName: 'New Trustee',
  verificationId: 'verification-1',
  ...overrides,
});

type RemapPageResult = Awaited<ReturnType<TrusteeVerificationRemapUseCase['remapPage']>>;

const makeRemapPageResult = (overrides: Partial<RemapPageResult> = {}): RemapPageResult => ({
  documentsWritten: 1,
  documentsFailed: 0,
  downstreamNotificationFailedCount: 0,
  totalCandidates: 1,
  pageSize: 1,
  remainingCount: 0,
  ...overrides,
});

/**
 * This file covers only handleRemap's own responsibilities -- queue-trigger mechanics
 * (env var guard, pagination continuation requeue, rate-limit/DLQ routing, telemetry, and
 * writing the verification document's remap status) -- by mocking its one real collaborator,
 * TrusteeVerificationRemapUseCase.remapPage, directly. The remap business rules themselves
 * (soft-close-before-upsert ordering, per-surrogate division re-validation, downstream-event
 * payload shape, etc.) are exhaustively covered in
 * backend/lib/use-cases/dataflows/trustee-verification-remap.test.ts against the use case
 * directly; duplicating them here against the same collaborator through an extra layer of
 * mocked repositories only doubles the maintenance surface without adding signal.
 */
describe('trustee-verification-remap handleRemap', () => {
  let mockUpdateVerification: ReturnType<typeof vi.fn>;
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let remapPageSpy: Mock<TrusteeVerificationRemapUseCase['remapPage']>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';

    mockUpdateVerification = vi.fn().mockResolvedValue({});
    mockSendMessage = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(factory, 'getTrusteeMatchVerificationRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        update: mockUpdateVerification,
      }),
    );
    vi.spyOn(StorageQueueHumbleObject, 'fromConnectionString').mockReturnValue({
      sendMessage: mockSendMessage,
    } as unknown as StorageQueueHumbleObject);
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    remapPageSpy = vi.spyOn(TrusteeVerificationRemapUseCase.prototype, 'remapPage');
  });

  test('writes "complete" status and success telemetry when the use case reports a fully successful page', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    remapPageSpy.mockResolvedValue(makeRemapPageResult());
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleRemap(makeMessage(), makeInvocationContext());

    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'TRUSTEE-MATCH-VERIFICATION-REMAP',
      'handleRemap',
      expect.anything(),
      expect.objectContaining({ success: true, documentsWritten: 1, documentsFailed: 0 }),
    );
    expect(mockUpdateVerification).toHaveBeenCalledWith('verification-1', {
      remap: { status: 'complete' },
    });
  });

  test('writes "error" status and failure telemetry when the use case reports per-case failures', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    remapPageSpy.mockResolvedValue(
      makeRemapPageResult({ documentsWritten: 1, documentsFailed: 1, pageSize: 2 }),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    const message = makeMessage();
    await handleRemap(message, makeInvocationContext());

    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'TRUSTEE-MATCH-VERIFICATION-REMAP',
      'handleRemap',
      expect.anything(),
      expect.objectContaining({ success: false, documentsWritten: 1, documentsFailed: 1 }),
    );
    // Aggregate status only -- no per-case-id breakdown on the verification document itself.
    expect(mockUpdateVerification).toHaveBeenCalledWith('verification-1', {
      remap: {
        status: 'error',
        error: expect.objectContaining({
          message: expect.stringContaining(message.fingerprint),
          data: message,
        }),
      },
    });
  });

  test('counts a failed downstream notification separately without treating the remap as failed', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    remapPageSpy.mockResolvedValue(
      makeRemapPageResult({ documentsWritten: 1, downstreamNotificationFailedCount: 1 }),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleRemap(makeMessage(), makeInvocationContext());

    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'TRUSTEE-MATCH-VERIFICATION-REMAP',
      'handleRemap',
      expect.anything(),
      expect.objectContaining({
        success: true,
        documentsWritten: 1,
        documentsFailed: 0,
        details: expect.objectContaining({ downstreamNotificationFailedCount: '1' }),
        additionalMetrics: [
          { name: 'TrusteeVerificationRemapDownstreamNotificationFailedCount', value: 1 },
        ],
      }),
    );
  });

  test('a batch with no remaining surrogates (already fully remapped) is a no-op success', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    remapPageSpy.mockResolvedValue(
      makeRemapPageResult({ documentsWritten: 0, totalCandidates: 0, pageSize: 0 }),
    );
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleRemap(makeMessage(), makeInvocationContext());

    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'TRUSTEE-MATCH-VERIFICATION-REMAP',
      'handleRemap',
      expect.anything(),
      expect.objectContaining({ success: true, documentsWritten: 0, documentsFailed: 0 }),
    );
    expect(mockUpdateVerification).toHaveBeenCalledWith('verification-1', {
      remap: { status: 'complete' },
    });
  });

  test('a rate-limit error from the use case requeues with backoff and emits rate-limited-requeued telemetry, leaving verification status untouched', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    const tooManyError = new TooManyRequestsError('TRUSTEE-MATCH-VERIFICATION-REMAP');
    remapPageSpy.mockRejectedValue(tooManyError);
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleRemap(makeMessage({ retryCount: 0 }), makeInvocationContext());

    expect(mockSendMessage).toHaveBeenCalled();
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'TRUSTEE-MATCH-VERIFICATION-REMAP',
      'handleRemap',
      expect.anything(),
      expect.objectContaining({ success: false, error: 'rate-limited-requeued' }),
    );
    // A transient rate-limit backoff isn't a terminal outcome -- leave whatever remap.status
    // approveVerification/a prior page already wrote (pending/processing) untouched.
    expect(mockUpdateVerification).not.toHaveBeenCalled();
  });

  test('routes to DLQ and emits telemetry when the retry limit is exhausted', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    const tooManyError = new TooManyRequestsError('TRUSTEE-MATCH-VERIFICATION-REMAP');
    remapPageSpy.mockRejectedValue(tooManyError);
    const mockContext = await createMockApplicationContext();
    const extraOutputsSetSpy = vi.spyOn(mockContext.extraOutputs, 'set');
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
    const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

    await handleRemap(makeMessage({ retryCount: 10 }), makeInvocationContext());

    expect(extraOutputsSetSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queueName: expect.stringContaining('dlq') }),
      expect.anything(),
    );
    expect(telemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'TRUSTEE-MATCH-VERIFICATION-REMAP',
      'handleRemap',
      expect.anything(),
      expect.objectContaining({
        success: false,
        documentsFailed: 1,
        error: 'rate-limit-retry-exhausted',
      }),
    );
    // getCamsErrorWithStack passes an already-CamsError (TooManyRequestsError) through via
    // addCamsStack rather than rewrapping it, so it keeps its own message/status here.
    expect(mockUpdateVerification).toHaveBeenCalledWith('verification-1', {
      remap: {
        status: 'error',
        error: expect.objectContaining({ message: 'Too Many Requests', status: 429 }),
      },
    });
  });

  test('rethrows non-rate-limit errors', async () => {
    const { handleRemap } = await import('./trustee-verification-remap');
    remapPageSpy.mockRejectedValue(new Error('boom'));

    const message = makeMessage();
    await expect(handleRemap(message, makeInvocationContext())).rejects.toThrow('boom');

    expect(mockUpdateVerification).toHaveBeenCalledWith('verification-1', {
      remap: {
        status: 'error',
        error: expect.objectContaining({
          data: message,
          originalError: expect.stringContaining('boom'),
        }),
      },
    });
  });

  test('throws when AzureWebJobsDataflowsStorage is not configured', async () => {
    delete process.env.AzureWebJobsDataflowsStorage;
    const { handleRemap } = await import('./trustee-verification-remap');

    await expect(handleRemap(makeMessage(), makeInvocationContext())).rejects.toThrow(
      'Missing required environment variable: AzureWebJobsDataflowsStorage',
    );
  });

  describe('batch pagination', () => {
    test('processes only one page and requeues a continuation when surrogates exceed the page size', async () => {
      const { handleRemap } = await import('./trustee-verification-remap');
      remapPageSpy.mockResolvedValue(
        makeRemapPageResult({
          documentsWritten: 25,
          totalCandidates: 30,
          pageSize: 25,
          remainingCount: 5,
        }),
      );
      const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

      const message = makeMessage();
      await handleRemap(message, makeInvocationContext());

      expect(mockSendMessage).toHaveBeenCalledWith(JSON.stringify(message));
      expect(telemetrySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'TRUSTEE-MATCH-VERIFICATION-REMAP',
        'handleRemap',
        expect.anything(),
        expect.objectContaining({
          success: true,
          documentsWritten: 25,
          details: expect.objectContaining({
            totalCandidates: '30',
            pageSize: '25',
            continuationQueued: 'true',
          }),
        }),
      );
      // More pages remain and nothing failed yet -- 'processing', not a terminal status.
      expect(mockUpdateVerification).toHaveBeenCalledWith('verification-1', {
        remap: { status: 'processing' },
      });
    });

    test('does not requeue a continuation when surrogates fit within one page', async () => {
      const { handleRemap } = await import('./trustee-verification-remap');
      remapPageSpy.mockResolvedValue(
        makeRemapPageResult({ documentsWritten: 3, totalCandidates: 3, pageSize: 3 }),
      );
      const telemetrySpy = vi.spyOn(DataflowTelemetry, 'completeDataflowTrace');

      await handleRemap(makeMessage(), makeInvocationContext());

      expect(mockSendMessage).not.toHaveBeenCalled();
      expect(telemetrySpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'TRUSTEE-MATCH-VERIFICATION-REMAP',
        'handleRemap',
        expect.anything(),
        expect.objectContaining({
          details: expect.objectContaining({
            pageSize: '3',
            continuationQueued: 'false',
          }),
        }),
      );
      expect(mockUpdateVerification).toHaveBeenCalledWith('verification-1', {
        remap: { status: 'complete' },
      });
    });
  });
});
