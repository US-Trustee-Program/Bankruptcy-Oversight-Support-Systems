import { vi, describe, test, expect, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import ApplicationContextCreator from '../../azure/application-context-creator';
import BackfillTrusteeAppointmentsDownstream from '../../../lib/use-cases/dataflows/backfill-trustee-appointments-downstream';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { handleStart, handlePage } from './backfill-trustee-appointments-downstream';
import { CursorMessage, StartMessage } from '../dataflows-common';
import { CaseAppointment } from '@common/cams/trustee-appointments';

function makeAppointment(caseId: string, id: string): CaseAppointment & { _id: string } {
  return {
    _id: id,
    caseId,
    trusteeId: 'trustee-001',
    assignedOn: '2024-01-01T00:00:00.000Z',
    documentType: 'CASE_APPOINTMENT',
  } as CaseAppointment & { _id: string };
}

describe('backfill-trustee-appointments-downstream', () => {
  let invocationContext: InvocationContext;
  const extraOutputsMap = new Map();

  beforeEach(async () => {
    extraOutputsMap.clear();
    invocationContext = {
      invocationId: 'test-invocation-id',
      functionName: 'backfill-trustee-appointments-downstream-handleStart',
      extraOutputs: {
        set: vi.fn((key, value) => extraOutputsMap.set(key, value)),
        get: vi.fn((key) => extraOutputsMap.get(key)),
      },
      log: vi.fn(),
    } as unknown as InvocationContext;
  });

  describe('handleStart', () => {
    test('should return early without queuing PAGE when feature flag is off', async () => {
      const mockContext = await createMockApplicationContext();
      mockContext.featureFlags['downstream-trustee-appointments-enabled'] = false;
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

      await handleStart({} as StartMessage, invocationContext);

      expect(invocationContext.extraOutputs.set).not.toHaveBeenCalled();
    });

    test('should return early without queuing PAGE when backfill state is COMPLETED', async () => {
      const mockContext = await createMockApplicationContext();
      mockContext.featureFlags['downstream-trustee-appointments-enabled'] = true;
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'readBackfillState').mockResolvedValue({
        data: {
          id: 'state-id',
          documentType: 'TRUSTEE_APPOINTMENTS_DOWNSTREAM_BACKFILL_STATE',
          status: 'COMPLETED',
          lastId: 'last-doc-id',
          processedCount: 42,
          startedAt: '2024-01-01T00:00:00.000Z',
          lastUpdatedAt: '2024-01-02T00:00:00.000Z',
        },
      });

      await handleStart({} as StartMessage, invocationContext);

      expect(invocationContext.extraOutputs.set).not.toHaveBeenCalled();
    });

    test('should queue PAGE with null lastId on fresh run (no existing state)', async () => {
      const mockContext = await createMockApplicationContext();
      mockContext.featureFlags['downstream-trustee-appointments-enabled'] = true;
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'readBackfillState').mockResolvedValue({
        data: null,
      });

      await handleStart({} as StartMessage, invocationContext);

      expect(invocationContext.extraOutputs.set).toHaveBeenCalledOnce();
      const [, cursorMessage] = (invocationContext.extraOutputs.set as ReturnType<typeof vi.fn>)
        .mock.calls[0];
      expect((cursorMessage as CursorMessage).lastId).toBeNull();
    });

    test('should queue PAGE with existing lastId when resuming in-progress backfill', async () => {
      const mockContext = await createMockApplicationContext();
      mockContext.featureFlags['downstream-trustee-appointments-enabled'] = true;
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'readBackfillState').mockResolvedValue({
        data: {
          id: 'state-id',
          documentType: 'TRUSTEE_APPOINTMENTS_DOWNSTREAM_BACKFILL_STATE',
          status: 'IN_PROGRESS',
          lastId: 'cursor-abc',
          processedCount: 10,
          startedAt: '2024-01-01T00:00:00.000Z',
          lastUpdatedAt: '2024-01-01T01:00:00.000Z',
        },
      });

      await handleStart({} as StartMessage, invocationContext);

      expect(invocationContext.extraOutputs.set).toHaveBeenCalledOnce();
      const [, cursorMessage] = (invocationContext.extraOutputs.set as ReturnType<typeof vi.fn>)
        .mock.calls[0];
      expect((cursorMessage as CursorMessage).lastId).toBe('cursor-abc');
    });

    test('should send to DLQ when readBackfillState returns an error', async () => {
      const mockContext = await createMockApplicationContext();
      mockContext.featureFlags['downstream-trustee-appointments-enabled'] = true;
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      const stateError = new CamsError('TEST', { message: 'State read failed' });
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'readBackfillState').mockResolvedValue({
        error: stateError,
      });

      await handleStart({} as StartMessage, invocationContext);

      expect(invocationContext.extraOutputs.set).toHaveBeenCalledOnce();
      const [, dlqMessage] = (invocationContext.extraOutputs.set as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(dlqMessage).toMatchObject({ type: 'QUEUE_ERROR', module: expect.any(String) });
    });
  });

  describe('handlePage', () => {
    test('should queue next PAGE when getPageOfAppointments returns hasMore=true', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'readBackfillState').mockResolvedValue({
        data: null,
      });
      const appointments = [makeAppointment('case-1', 'doc-1'), makeAppointment('case-2', 'doc-2')];
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'getPageOfAppointments').mockResolvedValue({
        data: { appointments, lastId: 'doc-2', hasMore: true },
      });
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'processAppointmentsPage').mockResolvedValue({
        data: { successCount: 2, errors: [] },
      });
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'updateBackfillState').mockResolvedValue({
        data: expect.anything() as never,
      });

      await handlePage({ lastId: null } as CursorMessage, invocationContext);

      const pageOutputs = [...extraOutputsMap.values()].filter(
        (v) => v && typeof v === 'object' && 'lastId' in v,
      );
      expect(pageOutputs).toHaveLength(1);
      expect(pageOutputs[0].lastId).toBe('doc-2');
    });

    test('should NOT queue next PAGE when getPageOfAppointments returns hasMore=false', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'readBackfillState').mockResolvedValue({
        data: null,
      });
      const appointments = [makeAppointment('case-1', 'doc-1')];
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'getPageOfAppointments').mockResolvedValue({
        data: { appointments, lastId: 'doc-1', hasMore: false },
      });
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'processAppointmentsPage').mockResolvedValue({
        data: { successCount: 1, errors: [] },
      });
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'updateBackfillState').mockResolvedValue({
        data: expect.anything() as never,
      });

      await handlePage({ lastId: null } as CursorMessage, invocationContext);

      expect(invocationContext.extraOutputs.set).not.toHaveBeenCalled();
    });

    test('should send to DLQ when getPageOfAppointments returns an error', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'readBackfillState').mockResolvedValue({
        data: null,
      });
      const pageError = new CamsError('TEST', { message: 'Page fetch failed' });
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'getPageOfAppointments').mockResolvedValue({
        error: pageError,
      });

      await handlePage({ lastId: null } as CursorMessage, invocationContext);

      expect(invocationContext.extraOutputs.set).toHaveBeenCalledOnce();
      const [, dlqMessage] = (invocationContext.extraOutputs.set as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(dlqMessage).toMatchObject({ type: 'QUEUE_ERROR', module: expect.any(String) });
    });

    test('should send to DLQ when readBackfillState errors and does NOT call getPageOfAppointments', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      const stateError = new CamsError('TEST', { message: 'State read failed in handlePage' });
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'readBackfillState').mockResolvedValue({
        error: stateError,
      });
      const getPageSpy = vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'getPageOfAppointments');

      await handlePage({ lastId: null } as CursorMessage, invocationContext);

      expect(getPageSpy).not.toHaveBeenCalled();
      expect(invocationContext.extraOutputs.set).toHaveBeenCalledOnce();
      const [, dlqMessage] = (invocationContext.extraOutputs.set as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(dlqMessage).toMatchObject({ type: 'QUEUE_ERROR', module: expect.any(String) });
    });

    test('should write COMPLETED state and NOT call processAppointmentsPage when getPageOfAppointments returns empty appointments', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'readBackfillState').mockResolvedValue({
        data: {
          id: 'state-id',
          documentType: 'TRUSTEE_APPOINTMENTS_DOWNSTREAM_BACKFILL_STATE',
          status: 'IN_PROGRESS',
          lastId: 'cursor-abc',
          processedCount: 7,
          startedAt: '2024-01-01T00:00:00.000Z',
          lastUpdatedAt: '2024-01-01T01:00:00.000Z',
        },
      });
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'getPageOfAppointments').mockResolvedValue({
        data: { appointments: [], lastId: 'cursor-abc', hasMore: false },
      });
      const processSpy = vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'processAppointmentsPage');
      const updateSpy = vi
        .spyOn(BackfillTrusteeAppointmentsDownstream, 'updateBackfillState')
        .mockResolvedValue({ data: expect.anything() as never });

      await handlePage({ lastId: 'cursor-abc' } as CursorMessage, invocationContext);

      expect(processSpy).not.toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'COMPLETED' }),
      );
      expect(invocationContext.extraOutputs.set).not.toHaveBeenCalled();
    });

    test('should send to DLQ when updateBackfillState errors after processAppointmentsPage succeeds and NOT queue PAGE even if hasMore=true', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'readBackfillState').mockResolvedValue({
        data: null,
      });
      const appointments = [makeAppointment('case-1', 'doc-1'), makeAppointment('case-2', 'doc-2')];
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'getPageOfAppointments').mockResolvedValue({
        data: { appointments, lastId: 'doc-2', hasMore: true },
      });
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'processAppointmentsPage').mockResolvedValue({
        data: { successCount: 2, errors: [] },
      });
      const updateError = new CamsError('TEST', { message: 'State update failed' });
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'updateBackfillState').mockResolvedValue({
        error: updateError,
      });

      await handlePage({ lastId: null } as CursorMessage, invocationContext);

      expect(invocationContext.extraOutputs.set).toHaveBeenCalledOnce();
      const [, dlqMessage] = (invocationContext.extraOutputs.set as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(dlqMessage).toMatchObject({ type: 'QUEUE_ERROR', module: expect.any(String) });
    });

    test('should send to DLQ and update state to FAILED when processAppointmentsPage returns an error', async () => {
      const mockContext = await createMockApplicationContext();
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'readBackfillState').mockResolvedValue({
        data: {
          id: 'state-id',
          documentType: 'TRUSTEE_APPOINTMENTS_DOWNSTREAM_BACKFILL_STATE',
          status: 'IN_PROGRESS',
          lastId: null,
          processedCount: 5,
          startedAt: '2024-01-01T00:00:00.000Z',
          lastUpdatedAt: '2024-01-01T01:00:00.000Z',
        },
      });
      const appointments = [makeAppointment('case-1', 'doc-1')];
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'getPageOfAppointments').mockResolvedValue({
        data: { appointments, lastId: 'doc-1', hasMore: false },
      });
      const processError = new CamsError('TEST', { message: 'Process page failed' });
      vi.spyOn(BackfillTrusteeAppointmentsDownstream, 'processAppointmentsPage').mockResolvedValue({
        error: processError,
      });
      const updateSpy = vi
        .spyOn(BackfillTrusteeAppointmentsDownstream, 'updateBackfillState')
        .mockResolvedValue({ data: expect.anything() as never });

      await handlePage({ lastId: null } as CursorMessage, invocationContext);

      expect(updateSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'FAILED' }),
      );
      expect(invocationContext.extraOutputs.set).toHaveBeenCalledOnce();
      const [, dlqMessage] = (invocationContext.extraOutputs.set as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(dlqMessage).toMatchObject({ type: 'QUEUE_ERROR', module: expect.any(String) });
    });
  });

  describe('module structure', () => {
    test('should export MODULE_NAME as the correct string', async () => {
      const module = await import('./backfill-trustee-appointments-downstream');
      expect(module.default.MODULE_NAME).toBe('BACKFILL-TRUSTEE-APPOINTMENTS-DOWNSTREAM');
    });

    test('should export a setup function', async () => {
      const module = await import('./backfill-trustee-appointments-downstream');
      expect(typeof module.default.setup).toBe('function');
    });
  });
});
