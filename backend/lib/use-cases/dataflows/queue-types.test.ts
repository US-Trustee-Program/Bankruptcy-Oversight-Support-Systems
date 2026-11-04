import { CamsError } from '../../common-errors/cams-error';
import { CaseSyncEvent } from '@common/cams/dataflow-events';
import MockData from '@common/cams/test-utilities/mock-data';
import { buildQueueError, isQueueError, QueueError, toCaseSyncEventSummary } from './queue-types';

describe('Queue types', () => {
  test('toCaseSyncEventSummary keeps only type and caseId', () => {
    const event: CaseSyncEvent = {
      type: 'CASE_CHANGED',
      caseId: '001-25-00001',
      bCase: MockData.getDxtrCase(),
      error: new CamsError('TEST_MODULE', { message: 'bad', data: { reason: 'test' } }),
      retryCount: 2,
      divisionChange: { orphanedCaseId: '081-25-00001', currentCaseId: '001-25-00001' },
    };

    expect(toCaseSyncEventSummary(event)).toEqual({
      type: 'CASE_CHANGED',
      caseId: '001-25-00001',
    });
  });

  test('isQueueError recognizes a QueueError built by buildQueueError', () => {
    const queueError = buildQueueError(new CamsError('TEST_MODULE'), 'TEST_MODULE', 'activity');

    expect(isQueueError(queueError)).toBe(true);
  });

  test('isQueueError rejects a case sync event and non-object values', () => {
    expect(isQueueError({ type: 'CASE_CHANGED', caseId: '001-25-00001' })).toBe(false);
    expect(isQueueError(null)).toBe(false);
    expect(isQueueError(undefined)).toBe(false);
    expect(isQueueError('QUEUE_ERROR')).toBe(false);
  });

  test('buildQueueError', () => {
    const module = 'TEST_MODULE';
    const error: CamsError = new CamsError(module);
    const activityName = 'activity';

    const expected: QueueError = {
      type: 'QUEUE_ERROR',
      activityName,
      error,
      module,
    };

    expect(buildQueueError(error, module, activityName)).toEqual(expected);
  });
});
