import { describe, test, expect, vi, beforeEach, MockInstance } from 'vitest';
import { InvocationContext } from '@azure/functions';
import { Trustee } from '@common/cams/trustees';
import MockData from '@common/cams/test-utilities/mock-data';
import ApplicationContextCreator from '../../azure/application-context-creator';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { ApplicationContext } from '../../../lib/adapters/types/basic';
import { CamsError } from '../../../lib/common-errors/cams-error';
import CorrectTrusteeZoomPhonesUseCase from '../../../lib/use-cases/dataflows/correct-trustee-zoom-phones';
import { handleStart } from './correct-trustee-zoom-phones';

const MODULE_NAME = 'CORRECT-TRUSTEE-ZOOM-PHONES';

type CorrectionResults = NonNullable<
  Awaited<ReturnType<typeof CorrectTrusteeZoomPhonesUseCase.correctZoomPhones>>['data']
>;

const makeInvocationContext = (): InvocationContext =>
  ({
    invocationId: 'test-id',
    functionName: 'correct-trustee-zoom-phones',
    extraOutputs: new Map(),
    log: vi.fn(),
  }) as unknown as InvocationContext;

const dlqOutputs = (invocationContext: InvocationContext) =>
  Array.from((invocationContext.extraOutputs as unknown as Map<unknown, unknown>).values());

describe('correct-trustee-zoom-phones migration', () => {
  let context: ApplicationContext;
  let invocationContext: InvocationContext;
  let warn: MockInstance;
  let info: MockInstance;
  const trustees: Trustee[] = [MockData.getTrustee({ trusteeId: 'trustee-001' })];

  const summary = (results: CorrectionResults['results']): CorrectionResults => {
    const counts = { converted: 0, alreadyValid: 0, flagged: 0, failed: 0 };
    results.forEach((r) => counts[r.outcome]++);
    return { results, counts };
  };

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    invocationContext = makeInvocationContext();
    vi.spyOn(ApplicationContextCreator, 'getApplicationContext').mockResolvedValue(context);
    warn = vi.spyOn(context.logger, 'warn');
    info = vi.spyOn(context.logger, 'info');
    vi.spyOn(CorrectTrusteeZoomPhonesUseCase, 'getTrusteesWithZoomInfo').mockResolvedValue({
      data: trustees,
    });
  });

  test('should log a warning per flagged trustee and a summary with counts', async () => {
    vi.spyOn(CorrectTrusteeZoomPhonesUseCase, 'correctZoomPhones').mockResolvedValue({
      data: summary([
        {
          trusteeId: 'trustee-001',
          trusteeName: 'Jane Doe',
          storedValue: '(680) 214-4529',
          outcome: 'converted',
          newValue: '680-214-4529',
        },
        {
          trusteeId: 'trustee-002',
          trusteeName: 'John Roe',
          storedValue: '680-214-4529',
          outcome: 'alreadyValid',
        },
        {
          trusteeId: 'trustee-003',
          trusteeName: 'Pat Poe',
          storedValue: '214-45',
          outcome: 'flagged',
          reason: 'Zoom phone has 5 digits.',
        },
        {
          trusteeId: 'trustee-004',
          trusteeName: 'Sam Moe',
          storedValue: undefined,
          outcome: 'flagged',
          reason: 'Zoom phone is empty or missing.',
        },
      ]),
    });

    await handleStart({}, invocationContext);

    expect(CorrectTrusteeZoomPhonesUseCase.correctZoomPhones).toHaveBeenCalledWith(
      context,
      trustees,
    );
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(
      MODULE_NAME,
      'Zoom phone flagged for review: trusteeId=trustee-003 name="Pat Poe" stored="214-45"',
    );
    expect(warn).toHaveBeenCalledWith(
      MODULE_NAME,
      'Zoom phone flagged for review: trusteeId=trustee-004 name="Sam Moe" stored=""',
    );
    expect(info).toHaveBeenCalledWith(
      MODULE_NAME,
      'Trustee Zoom phone correction complete. Converted: 1, Already valid: 1, Flagged: 2, Failed: 0.',
    );
    expect(dlqOutputs(invocationContext)).toEqual([]);
  });

  test('should send failed trustees to the DLQ', async () => {
    vi.spyOn(CorrectTrusteeZoomPhonesUseCase, 'correctZoomPhones').mockResolvedValue({
      data: summary([
        {
          trusteeId: 'trustee-001',
          trusteeName: 'Jane Doe',
          storedValue: '(680) 214-4529',
          outcome: 'failed',
          newValue: '680-214-4529',
          error: 'Update failed',
        },
        {
          trusteeId: 'trustee-002',
          trusteeName: 'John Roe',
          storedValue: '(555) 123-4567',
          outcome: 'converted',
          newValue: '555-123-4567',
        },
      ]),
    });

    await handleStart({}, invocationContext);

    expect(dlqOutputs(invocationContext)).toEqual([
      [{ trusteeId: 'trustee-001', error: 'Update failed' }],
    ]);
    expect(info).toHaveBeenCalledWith(
      MODULE_NAME,
      'Trustee Zoom phone correction complete. Converted: 1, Already valid: 0, Flagged: 0, Failed: 1.',
    );
  });

  test('should send a queue error to the DLQ when trustees cannot be loaded', async () => {
    const error = new CamsError(MODULE_NAME, { message: 'Failed to get trustees.' });
    vi.spyOn(CorrectTrusteeZoomPhonesUseCase, 'getTrusteesWithZoomInfo').mockResolvedValue({
      error,
    });
    const correct = vi.spyOn(CorrectTrusteeZoomPhonesUseCase, 'correctZoomPhones');

    await handleStart({}, invocationContext);

    expect(correct).not.toHaveBeenCalled();
    expect(dlqOutputs(invocationContext)).toEqual([
      expect.objectContaining({ type: 'QUEUE_ERROR', module: MODULE_NAME, error }),
    ]);
    expect(warn).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  test('should send a queue error to the DLQ when the correction fails', async () => {
    const error = new CamsError(MODULE_NAME, { message: 'Failed to correct.' });
    vi.spyOn(CorrectTrusteeZoomPhonesUseCase, 'correctZoomPhones').mockResolvedValue({ error });

    await handleStart({}, invocationContext);

    expect(dlqOutputs(invocationContext)).toEqual([
      expect.objectContaining({ type: 'QUEUE_ERROR', module: MODULE_NAME, error }),
    ]);
    expect(warn).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });
});
