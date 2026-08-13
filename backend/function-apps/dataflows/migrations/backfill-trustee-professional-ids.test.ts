import { describe, test, expect, vi, beforeEach } from 'vitest';
import { InvocationContext } from '@azure/functions';
import * as BackfillTrusteeProfessionalIdsUseCase from '../../../lib/use-cases/dataflows/backfill-trustee-professional-ids';
import * as DataflowsCommon from '../dataflows-common';
import * as DataflowTelemetry from '../../../lib/use-cases/dataflows/dataflow-telemetry';
import ApplicationContextCreator from '../../azure/application-context-creator';
import factory from '../../../lib/factory';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { getCamsError } from '../../../lib/common-errors/error-utilities';
import { AcmsTrusteeProfessionalRecord } from '../../../lib/use-cases/gateways.types';
import type {
  BackfillTrusteeProfessionalIdsPageMessage,
  BackfillTrusteeProfessionalIdsStartMessage,
} from './backfill-trustee-professional-ids';

const MODULE_NAME = 'BACKFILL-TRUSTEE-PROFESSIONAL-IDS';

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'backfill-trustee-professional-ids',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

function makeRecord(id: string): AcmsTrusteeProfessionalRecord {
  return {
    acmsProfessionalId: id,
    firstName: 'Jane',
    lastName: 'Doe',
    middleInitial: null,
    address1: null,
    address2: null,
    city: null,
    state: 'NY',
    zip: null,
    phone: null,
  };
}

describe('backfill-trustee-professional-ids', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'DefaultEndpointsProtocol=https://test';
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(
      await createMockApplicationContext(),
    );
    vi.spyOn(DataflowTelemetry, 'completeDataflowTrace').mockReturnValue(undefined);
    vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
      getDivisionToCourtMap: vi.fn().mockResolvedValue(new Map([['081', '0208']])),
    } as unknown as ReturnType<typeof factory.getAcmsGateway>);
  });

  describe('handleStart', () => {
    test('fresh-start happy path: reads all records, chunks correctly, emits the right number of PAGE messages', async () => {
      const { handleStart } = await import('./backfill-trustee-professional-ids');
      const invocationContext = makeInvocationContext();

      // 125 records at WRITE_BATCH_SIZE=50 -> 3 chunks (50, 50, 25).
      const records = Array.from({ length: 125 }, (_, i) => makeRecord(`prof-${i}`));
      vi.spyOn(
        BackfillTrusteeProfessionalIdsUseCase,
        'readAllAcmsProfessionalRecords',
      ).mockResolvedValue({ data: records });

      await handleStart({}, invocationContext);

      const outputsMap = invocationContext.extraOutputs as Map<unknown, unknown>;
      const pageOutputEntry = [...outputsMap.entries()].find(([queue]) =>
        (queue as { queueName: string }).queueName?.includes('page'),
      );
      expect(pageOutputEntry).toBeDefined();

      const pageMessages = (pageOutputEntry![1] as string[]).map(
        (raw) => JSON.parse(raw) as BackfillTrusteeProfessionalIdsPageMessage,
      );
      expect(pageMessages).toHaveLength(3);
      expect(pageMessages[0].records).toHaveLength(50);
      expect(pageMessages[1].records).toHaveLength(50);
      expect(pageMessages[2].records).toHaveLength(25);

      // Every record is present across all chunks, none dropped or duplicated.
      const allRecordIds = pageMessages.flatMap((m) => m.records.map((r) => r.acmsProfessionalId));
      expect(allRecordIds).toHaveLength(125);
      expect(new Set(allRecordIds).size).toBe(125);

      // Division-to-court map is threaded through every page message.
      for (const pageMessage of pageMessages) {
        expect(pageMessage.divisionToCourtMap).toEqual([['081', '0208']]);
      }
    });

    test('logs a timing checkpoint (elapsed ms) around the read-and-dispatch pass', async () => {
      const { handleStart } = await import('./backfill-trustee-professional-ids');
      const invocationContext = makeInvocationContext();

      const mockContext = await createMockApplicationContext();
      const loggerInfoSpy = vi.spyOn(mockContext.logger, 'info');
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

      vi.spyOn(
        BackfillTrusteeProfessionalIdsUseCase,
        'readAllAcmsProfessionalRecords',
      ).mockResolvedValue({ data: [makeRecord('prof-1')] });

      await handleStart({}, invocationContext);

      const timingLogCalls = loggerInfoSpy.mock.calls.filter((call) =>
        String(call[1]).includes('read-and-dispatch complete'),
      );
      expect(timingLogCalls).toHaveLength(1);
      expect(String(timingLogCalls[0][1])).toMatch(/in \d+ms/);
    });

    test('routes to DLQ when the ACMS read fails', async () => {
      const { handleStart } = await import('./backfill-trustee-professional-ids');
      const invocationContext = makeInvocationContext();

      vi.spyOn(
        BackfillTrusteeProfessionalIdsUseCase,
        'readAllAcmsProfessionalRecords',
      ).mockResolvedValue({
        error: getCamsError(new Error('sql timeout'), MODULE_NAME, 'sql timeout'),
      });

      await handleStart({}, invocationContext);

      const outputsMap = invocationContext.extraOutputs as Map<unknown, unknown>;
      const dlqEntry = [...outputsMap.entries()].find(([queue]) =>
        (queue as { queueName: string }).queueName?.includes('dlq'),
      );
      expect(dlqEntry).toBeDefined();
      expect(dlqEntry![1]).toEqual(
        expect.objectContaining({
          module: MODULE_NAME,
          error: expect.objectContaining({ message: expect.stringContaining('sql timeout') }),
        }),
      );

      // No PAGE messages emitted on a failed read.
      const pageEntry = [...outputsMap.entries()].find(([queue]) =>
        (queue as { queueName: string }).queueName?.includes('page'),
      );
      expect(pageEntry).toBeUndefined();
    });

    test('flushQueues: true triggers the diagnostic dump path and does NOT proceed to normal processing', async () => {
      const { handleStart } = await import('./backfill-trustee-professional-ids');
      const invocationContext = makeInvocationContext();

      const dumpQueueToBlobSpy = vi.spyOn(DataflowsCommon, 'dumpQueueToBlob').mockResolvedValue(0);
      const readSpy = vi.spyOn(
        BackfillTrusteeProfessionalIdsUseCase,
        'readAllAcmsProfessionalRecords',
      );

      await handleStart({ flushQueues: true }, invocationContext);

      // Dumps all 4 queues (start, page, dlq, failures).
      expect(dumpQueueToBlobSpy).toHaveBeenCalledTimes(4);
      const dumpedQueueNames = dumpQueueToBlobSpy.mock.calls.map((call) => call[4]);
      expect(dumpedQueueNames.some((name) => String(name).includes('start'))).toBe(true);
      expect(dumpedQueueNames.some((name) => String(name).includes('page'))).toBe(true);
      expect(dumpedQueueNames.some((name) => String(name).includes('dlq'))).toBe(true);
      expect(dumpedQueueNames.some((name) => String(name).includes('failures'))).toBe(true);

      // Did NOT proceed to the normal bulk-read-and-dispatch path.
      expect(readSpy).not.toHaveBeenCalled();

      const outputsMap = invocationContext.extraOutputs as Map<unknown, unknown>;
      const pageEntry = [...outputsMap.entries()].find(([queue]) =>
        (queue as { queueName: string }).queueName?.includes('page'),
      );
      expect(pageEntry).toBeUndefined();
    });

    test('StartMessage type only accepts flushQueues -- no resume/halt/lastId special-casing exists', async () => {
      const { handleStart } = await import('./backfill-trustee-professional-ids');
      const invocationContext = makeInvocationContext();

      vi.spyOn(
        BackfillTrusteeProfessionalIdsUseCase,
        'readAllAcmsProfessionalRecords',
      ).mockResolvedValue({ data: [] });

      // Extraneous resume/halt-like fields are not part of the type and (cast through unknown to
      // simulate a malformed/legacy message at the JSON boundary) must have zero special-cased
      // effect -- handleStart always does the same fresh bulk read-and-dispatch regardless.
      const messageWithExtraneousFields = {
        resume: true,
        halt: true,
        lastId: 42,
      } as unknown as BackfillTrusteeProfessionalIdsStartMessage;

      await handleStart(messageWithExtraneousFields, invocationContext);

      // No halt-purge, no resume-from-cursor behavior — just the ordinary fresh read-and-dispatch
      // path ran (read was called, no DLQ/error routing, no cursor-based branching).
      expect(
        BackfillTrusteeProfessionalIdsUseCase.readAllAcmsProfessionalRecords,
      ).toHaveBeenCalledWith(expect.anything());
      const outputsMap = invocationContext.extraOutputs as Map<unknown, unknown>;
      const dlqEntry = [...outputsMap.entries()].find(([queue]) =>
        (queue as { queueName: string }).queueName?.includes('dlq'),
      );
      expect(dlqEntry).toBeUndefined();
    });
  });

  describe('handlePage', () => {
    test('calls processAcmsProfessionalRecordsPage with the chunk of records and the division-to-court map', async () => {
      const { handlePage } = await import('./backfill-trustee-professional-ids');
      const invocationContext = makeInvocationContext();

      const processPageSpy = vi
        .spyOn(BackfillTrusteeProfessionalIdsUseCase, 'processAcmsProfessionalRecordsPage')
        .mockResolvedValue({ data: { matched: 2, unmatched: 1, alreadyMapped: 0 } });

      const records = [makeRecord('prof-1'), makeRecord('prof-2')];
      const message: BackfillTrusteeProfessionalIdsPageMessage = {
        records,
        divisionToCourtMap: [['081', '0208']],
      };

      await handlePage(message, invocationContext);

      expect(processPageSpy).toHaveBeenCalledWith(
        expect.anything(),
        records,
        new Map([['081', '0208']]),
      );
    });

    test('logs matched/unmatched/alreadyMapped counts on success', async () => {
      const { handlePage } = await import('./backfill-trustee-professional-ids');
      const invocationContext = makeInvocationContext();

      const mockContext = await createMockApplicationContext();
      const loggerInfoSpy = vi.spyOn(mockContext.logger, 'info');
      vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(mockContext);

      vi.spyOn(
        BackfillTrusteeProfessionalIdsUseCase,
        'processAcmsProfessionalRecordsPage',
      ).mockResolvedValue({ data: { matched: 3, unmatched: 2, alreadyMapped: 1 } });

      const message: BackfillTrusteeProfessionalIdsPageMessage = {
        records: [makeRecord('prof-1')],
        divisionToCourtMap: [],
      };

      await handlePage(message, invocationContext);

      const summaryLogCalls = loggerInfoSpy.mock.calls.filter((call) =>
        String(call[1]).includes('Backfill page complete'),
      );
      expect(summaryLogCalls).toHaveLength(1);
      expect(String(summaryLogCalls[0][1])).toContain('matched=3');
      expect(String(summaryLogCalls[0][1])).toContain('unmatched=2');
      expect(String(summaryLogCalls[0][1])).toContain('alreadyMapped=1');
    });

    test('routes errors to the FAILURES queue, not DLQ, and does not throw', async () => {
      const { handlePage } = await import('./backfill-trustee-professional-ids');
      const invocationContext = makeInvocationContext();

      vi.spyOn(
        BackfillTrusteeProfessionalIdsUseCase,
        'processAcmsProfessionalRecordsPage',
      ).mockRejectedValue(new Error('mongo write failed'));

      const message: BackfillTrusteeProfessionalIdsPageMessage = {
        records: [makeRecord('prof-1')],
        divisionToCourtMap: [],
      };

      await expect(handlePage(message, invocationContext)).resolves.toBeUndefined();

      const outputsMap = invocationContext.extraOutputs as Map<unknown, unknown>;
      const failuresEntry = [...outputsMap.entries()].find(([queue]) =>
        (queue as { queueName: string }).queueName?.includes('failures'),
      );
      expect(failuresEntry).toBeDefined();
      expect(String(failuresEntry![1])).toContain('mongo write failed');

      const dlqEntry = [...outputsMap.entries()].find(([queue]) =>
        (queue as { queueName: string }).queueName?.includes('dlq'),
      );
      expect(dlqEntry).toBeUndefined();
    });

    test('routes a use-case-level error result (MaybeData.error) to FAILURES', async () => {
      const { handlePage } = await import('./backfill-trustee-professional-ids');
      const invocationContext = makeInvocationContext();

      vi.spyOn(
        BackfillTrusteeProfessionalIdsUseCase,
        'processAcmsProfessionalRecordsPage',
      ).mockResolvedValue({ error: getCamsError(new Error('scoring blew up'), MODULE_NAME) });

      const message: BackfillTrusteeProfessionalIdsPageMessage = {
        records: [makeRecord('prof-1')],
        divisionToCourtMap: [],
      };

      await handlePage(message, invocationContext);

      const outputsMap = invocationContext.extraOutputs as Map<unknown, unknown>;
      const failuresEntry = [...outputsMap.entries()].find(([queue]) =>
        (queue as { queueName: string }).queueName?.includes('failures'),
      );
      expect(failuresEntry).toBeDefined();
      expect(String(failuresEntry![1])).toContain('scoring blew up');
    });
  });

  describe('handlePagePoison', () => {
    test('routes poison messages to DLQ', async () => {
      const { handlePagePoison } = await import('./backfill-trustee-professional-ids');
      const invocationContext = makeInvocationContext();

      await handlePagePoison({ garbage: 'unparseable' }, invocationContext);

      const outputsMap = invocationContext.extraOutputs as Map<unknown, unknown>;
      const dlqEntry = [...outputsMap.entries()].find(([queue]) =>
        (queue as { queueName: string }).queueName?.includes('dlq'),
      );
      expect(dlqEntry).toBeDefined();
    });
  });
});
