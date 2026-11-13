import { describe, test, expect, vi, beforeEach, afterEach, MockInstance } from 'vitest';
import { app, InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { ApplicationContext } from '../../../lib/adapters/types/basic';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { StorageQueueHumbleObject } from '../../../lib/humble-objects/storage-queue-humble';
import CorrectTrusteeZoomPhonesUseCase, {
  CorrectionPassOutcome,
} from '../../../lib/use-cases/dataflows/correct-trustee-zoom-phones';
import { buildQueueName } from '../dataflows-common';
import CorrectTrusteeZoomPhonesDataflow, { handleStart } from './correct-trustee-zoom-phones';

const MODULE_NAME = 'CORRECT-TRUSTEE-ZOOM-PHONES';
const START_QUEUE_NAME = buildQueueName(MODULE_NAME, 'start');
const DLQ_QUEUE_NAME = buildQueueName(MODULE_NAME, 'dlq');
// The handler adds a fixed 30 second delay to the backoff the use case recommends.
const CONTINUATION_DELAY_SECONDS = 30;
const BACKOFF_SECONDS = 120;

type Summary = Extract<CorrectionPassOutcome, { kind: 'complete' }>['summary'];

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'correct-trustee-zoom-phones',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

const queueOutputs = (invocationContext: InvocationContext) =>
  Array.from(
    (invocationContext.extraOutputs as unknown as Map<{ queueName: string }, unknown>).entries(),
  ).map(([binding, payload]) => [binding.queueName, payload]);

describe('correct-trustee-zoom-phones migration', () => {
  let context: ApplicationContext;
  let invocationContext: InvocationContext;
  let info: MockInstance;
  let runPass: MockInstance;
  let writeReport: MockInstance;
  const originalStorage = process.env.AzureWebJobsDataflowsStorage;

  const complete = (
    results: Summary['results'],
    counts: Summary['counts'] = { converted: 0, alreadyValid: 0, flagged: 0, failed: 0 },
  ): { data: CorrectionPassOutcome } => ({
    data: { kind: 'complete', summary: { results, counts } },
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    process.env.AzureWebJobsDataflowsStorage = 'UseDevelopmentStorage=true';
    context = await createMockApplicationContext();
    invocationContext = makeInvocationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(context);
    info = vi.spyOn(context.logger, 'info');
    runPass = vi.spyOn(CorrectTrusteeZoomPhonesUseCase, 'runCorrectionPass');
    writeReport = vi
      .spyOn(CorrectTrusteeZoomPhonesUseCase, 'writeFlaggedReport')
      .mockResolvedValue('migration-files/correct-trustee-zoom-phones-flagged.csv');
  });

  afterEach(() => {
    if (originalStorage === undefined) delete process.env.AzureWebJobsDataflowsStorage;
    else process.env.AzureWebJobsDataflowsStorage = originalStorage;
  });

  test('should record the flagged trustees in the report and the summary log, not the DLQ', async () => {
    const results: Summary['results'] = [
      { trusteeId: 'trustee-001', outcome: 'converted', newValue: '680-214-4529' },
      { trusteeId: 'trustee-002', outcome: 'alreadyValid' },
      {
        trusteeId: 'trustee-003',
        outcome: 'flagged',
        reason: 'Zoom phone has 5 digits.',
        trusteeName: 'Pat Poe',
        storedPhone: '214-45',
      },
      { trusteeId: 'trustee-004', outcome: 'flagged', reason: 'Zoom phone is empty or missing.' },
    ];
    runPass.mockResolvedValue(
      complete(results, { converted: 1, alreadyValid: 1, flagged: 2, failed: 0 }),
    );

    await handleStart({}, invocationContext);

    expect(writeReport).toHaveBeenCalledWith(context, results);
    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      MODULE_NAME,
      'Trustee Zoom phone correction complete. Converted: 1, Already valid: 1, Flagged: 2, Failed: 0. ' +
        'Flagged trustees: trustee-003 (Zoom phone has 5 digits.), trustee-004 (Zoom phone is empty or missing.) ' +
        'Flagged report: migration-files/correct-trustee-zoom-phones-flagged.csv',
    );
    expect(queueOutputs(invocationContext)).toEqual([]);
  });

  test.each([
    ['a fresh run starts from the initial state', {}, { converted: 0 }],
    [
      'a continuation resumes from the state it carries',
      { state: { converted: 42 } },
      { converted: 42 },
    ],
  ])(
    'should run the pass with the handler start time when %s',
    async (_description, message, state) => {
      runPass.mockResolvedValue(complete([]));

      await handleStart(message, invocationContext);

      expect(runPass).toHaveBeenCalledWith(context, state, { startedAt: expect.any(Number) });
    },
  );

  test('should send failed trustees to the DLQ', async () => {
    runPass.mockResolvedValue(
      complete(
        [
          {
            trusteeId: 'trustee-001',
            outcome: 'failed',
            newValue: '680-214-4529',
            error: 'Update failed',
          },
          { trusteeId: 'trustee-002', outcome: 'converted', newValue: '555-123-4567' },
        ],
        { converted: 1, alreadyValid: 0, flagged: 0, failed: 1 },
      ),
    );

    await handleStart({}, invocationContext);

    expect(queueOutputs(invocationContext)).toEqual([
      [DLQ_QUEUE_NAME, [{ trusteeId: 'trustee-001', error: 'Update failed' }]],
    ]);
    expect(info).toHaveBeenCalledWith(MODULE_NAME, expect.stringContaining('Failed: 1'));
  });

  test('should still report the counts and send failures plus a queue error to the DLQ when the report cannot be written', async () => {
    runPass.mockResolvedValue(
      complete(
        [
          { trusteeId: 'trustee-001', outcome: 'failed', error: 'Update failed' },
          { trusteeId: 'trustee-002', outcome: 'flagged', reason: 'Zoom phone has 5 digits.' },
        ],
        { converted: 0, alreadyValid: 0, flagged: 1, failed: 1 },
      ),
    );
    writeReport.mockRejectedValue(new Error('Storage unavailable'));

    await handleStart({}, invocationContext);

    expect(queueOutputs(invocationContext)).toEqual([
      [
        DLQ_QUEUE_NAME,
        [
          { trusteeId: 'trustee-001', error: 'Update failed' },
          expect.objectContaining({
            type: 'QUEUE_ERROR',
            module: MODULE_NAME,
            error: expect.objectContaining({ message: 'Storage unavailable' }),
          }),
        ],
      ],
    ]);
    const message = String(info.mock.calls[0][1]);
    expect(message).toContain('Flagged: 1, Failed: 1');
    expect(message).toContain('Flagged trustees: trustee-002 (Zoom phone has 5 digits.)');
    expect(message).not.toContain('Flagged report:');
  });

  test('should send a queue error to the DLQ when the pass fails', async () => {
    const error = new CamsError(MODULE_NAME, { message: 'Failed to correct.' });
    runPass.mockResolvedValue({ error });

    await handleStart({}, invocationContext);

    expect(queueOutputs(invocationContext)).toEqual([
      [
        DLQ_QUEUE_NAME,
        expect.objectContaining({ type: 'QUEUE_ERROR', module: MODULE_NAME, error }),
      ],
    ]);
    expect(info).not.toHaveBeenCalled();
  });

  test('should register handleStart on the start queue with the DLQ as an output', () => {
    const storageQueue = vi.spyOn(app, 'storageQueue').mockImplementation(() => {});

    CorrectTrusteeZoomPhonesDataflow.setup();

    expect(storageQueue).toHaveBeenCalledTimes(1);
    const [name, options] = storageQueue.mock.calls[0];
    expect(name).toEqual(`${MODULE_NAME}-handleStart`);
    expect(options).toEqual(
      expect.objectContaining({
        queueName: START_QUEUE_NAME,
        handler: handleStart,
        extraOutputs: [expect.objectContaining({ queueName: DLQ_QUEUE_NAME })],
      }),
    );
  });

  describe('when the pass escapes because the invocation budget is spent', () => {
    let sendMessage: MockInstance;
    let fromConnectionString: MockInstance;

    beforeEach(() => {
      sendMessage = vi.fn().mockResolvedValue(undefined);
      fromConnectionString = vi
        .spyOn(StorageQueueHumbleObject, 'fromConnectionString')
        .mockReturnValue({ sendMessage } as unknown as StorageQueueHumbleObject);
      runPass.mockResolvedValue({
        data: { kind: 'escape', state: { converted: 7 }, backoffSeconds: BACKOFF_SECONDS },
      });
    });

    test('should enqueue a continuation carrying the state on the start queue, delayed by the backoff', async () => {
      await handleStart({}, invocationContext);

      expect(fromConnectionString).toHaveBeenCalledWith(
        'UseDevelopmentStorage=true',
        START_QUEUE_NAME,
      );
      expect(sendMessage).toHaveBeenCalledWith(
        JSON.stringify({ state: { converted: 7 } }),
        CONTINUATION_DELAY_SECONDS + BACKOFF_SECONDS,
      );
      expect(info).toHaveBeenCalledWith(
        MODULE_NAME,
        expect.stringContaining('Converted so far: 7'),
      );
    });

    test('should neither write to the DLQ nor log a completion summary', async () => {
      await handleStart({}, invocationContext);

      expect(writeReport).not.toHaveBeenCalled();
      expect(queueOutputs(invocationContext)).toEqual([]);
      expect(info).not.toHaveBeenCalledWith(
        MODULE_NAME,
        expect.stringContaining('correction complete'),
      );
    });

    test('should send a queue error to the DLQ when the continuation cannot be enqueued', async () => {
      sendMessage.mockRejectedValue(new Error('Queue unavailable'));

      await handleStart({}, invocationContext);

      expect(queueOutputs(invocationContext)).toEqual([
        [
          DLQ_QUEUE_NAME,
          expect.objectContaining({
            type: 'QUEUE_ERROR',
            module: MODULE_NAME,
            error: expect.objectContaining({ message: 'Queue unavailable' }),
          }),
        ],
      ]);
    });

    test('should send a queue error to the DLQ when the storage connection is not configured', async () => {
      delete process.env.AzureWebJobsDataflowsStorage;

      await handleStart({}, invocationContext);

      expect(sendMessage).not.toHaveBeenCalled();
      expect(queueOutputs(invocationContext)).toEqual([
        [
          DLQ_QUEUE_NAME,
          expect.objectContaining({
            type: 'QUEUE_ERROR',
            error: expect.objectContaining({
              message: expect.stringContaining('AzureWebJobsDataflowsStorage'),
            }),
          }),
        ],
      ]);
    });
  });
});
