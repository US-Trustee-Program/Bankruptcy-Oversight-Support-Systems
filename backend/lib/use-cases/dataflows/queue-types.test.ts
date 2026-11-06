import { CamsError } from '../../common-errors/cams-error';
import { buildQueueError, isQueueError, QueueError } from './queue-types';

describe('Queue types', () => {
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
