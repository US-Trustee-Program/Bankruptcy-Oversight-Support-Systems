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
const REPORT_LOCATION = 'migration-files/correct-trustee-zoom-phones-flagged.csv';
// The handler adds a fixed 30 second delay to the backoff the use case recommends.
const CONTINUATION_DELAY_SECONDS = 30;
const BACKOFF_SECONDS = 120;

type Summary = Extract<CorrectionPassOutcome, { kind: 'complete' }>['summary'];

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'correct-trustee-zoom-phones',
    log: vi.fn(),
  }) as unknown as InvocationContext;

describe('correct-trustee-zoom-phones migration', () => {
  let context: ApplicationContext;
  let invocationContext: InvocationContext;
  let info: MockInstance;
  let logError: MockInstance;
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
    logError = vi.spyOn(context.logger, 'error');
    runPass = vi.spyOn(CorrectTrusteeZoomPhonesUseCase, 'runCorrectionPass');
    writeReport = vi
      .spyOn(CorrectTrusteeZoomPhonesUseCase, 'writeFlaggedReport')
      .mockResolvedValue(REPORT_LOCATION);
  });

  afterEach(() => {
    if (originalStorage === undefined) delete process.env.AzureWebJobsDataflowsStorage;
    else process.env.AzureWebJobsDataflowsStorage = originalStorage;
  });

  test('should record the flagged trustees in the report and the summary log', async () => {
    const results: Summary['results'] = [
      { trusteeId: 'trustee-001', outcome: 'converted', newValue: '555-010-0123' },
      { trusteeId: 'trustee-002', outcome: 'alreadyValid' },
      {
        trusteeId: 'trustee-003',
        outcome: 'flagged',
        reason: 'Zoom phone has 5 digits.',
        trusteeName: 'Pat Poe',
        storedPhone: '214-45',
      },
      {
        trusteeId: 'trustee-004',
        outcome: 'flagged',
        reason: 'Zoom phone is empty or missing.',
        trusteeName: 'Sam Moe',
      },
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
        `Flagged report: ${REPORT_LOCATION}`,
    );
    expect(logError).not.toHaveBeenCalled();
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

  test('should list the failed trustees in the summary log', async () => {
    runPass.mockResolvedValue(
      complete(
        [
          { trusteeId: 'trustee-001', outcome: 'failed', newValue: '555-010-0123' },
          { trusteeId: 'trustee-002', outcome: 'failed', newValue: '555-123-4567' },
          { trusteeId: 'trustee-003', outcome: 'converted', newValue: '555-987-6543' },
        ],
        { converted: 1, alreadyValid: 0, flagged: 0, failed: 2 },
      ),
    );

    await handleStart({}, invocationContext);

    expect(info).toHaveBeenCalledWith(
      MODULE_NAME,
      expect.stringContaining('Failed: 2. Failed trustees: trustee-001, trustee-002'),
    );
  });

  test('should log an error and stop when the pass fails', async () => {
    runPass.mockResolvedValue({
      error: new CamsError(MODULE_NAME, { message: 'Failed to correct.' }),
    });

    await handleStart({}, invocationContext);

    expect(logError).toHaveBeenCalledWith(
      MODULE_NAME,
      'Trustee Zoom phone correction failed. Failed to correct.',
    );
    expect(writeReport).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  test('should log an error but still report the counts and the flagged trustees when the report cannot be written', async () => {
    runPass.mockResolvedValue(
      complete(
        [
          {
            trusteeId: 'trustee-002',
            outcome: 'flagged',
            reason: 'Zoom phone has 5 digits.',
            trusteeName: 'Pat Poe',
          },
        ],
        { converted: 0, alreadyValid: 0, flagged: 1, failed: 0 },
      ),
    );
    writeReport.mockRejectedValue(new Error('Storage unavailable'));

    await handleStart({}, invocationContext);

    expect(logError).toHaveBeenCalledWith(
      MODULE_NAME,
      'Flagged phones report could not be written. Storage unavailable',
    );
    const message = String(info.mock.calls[0][1]);
    expect(message).toContain('Flagged trustees: trustee-002 (Zoom phone has 5 digits.)');
    expect(message).not.toContain('Flagged report:');
  });

  test('should register handleStart on the start queue without a dead-letter output', () => {
    const storageQueue = vi.spyOn(app, 'storageQueue').mockImplementation(() => {});

    CorrectTrusteeZoomPhonesDataflow.setup();

    expect(storageQueue).toHaveBeenCalledTimes(1);
    const [name, options] = storageQueue.mock.calls[0];
    expect(name).toEqual(`${MODULE_NAME}-handleStart`);
    expect(options).toEqual(
      expect.objectContaining({ queueName: START_QUEUE_NAME, handler: handleStart }),
    );
    expect(options).not.toHaveProperty('extraOutputs');
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

    test('should keep the continuation message far below the 64 KB queue message limit', async () => {
      await handleStart({}, invocationContext);

      const body = sendMessage.mock.calls[0][0] as string;
      expect(Buffer.from(body).toString('base64').length).toBeLessThan(100);
    });

    test('should neither report a completion nor write the report', async () => {
      await handleStart({}, invocationContext);

      expect(writeReport).not.toHaveBeenCalled();
      expect(logError).not.toHaveBeenCalled();
      expect(info).not.toHaveBeenCalledWith(
        MODULE_NAME,
        expect.stringContaining('correction complete'),
      );
    });

    test('should log an error saying to re-run when the continuation cannot be enqueued', async () => {
      sendMessage.mockRejectedValue(new Error('Queue unavailable'));

      await handleStart({}, invocationContext);

      expect(logError).toHaveBeenCalledWith(
        MODULE_NAME,
        'Continuation could not be enqueued; re-run the migration. Converted so far: 7. Queue unavailable',
      );
    });

    test('should log an error when the storage connection is not configured', async () => {
      delete process.env.AzureWebJobsDataflowsStorage;

      await handleStart({}, invocationContext);

      expect(sendMessage).not.toHaveBeenCalled();
      expect(logError).toHaveBeenCalledWith(
        MODULE_NAME,
        expect.stringContaining('AzureWebJobsDataflowsStorage'),
      );
    });
  });
});
