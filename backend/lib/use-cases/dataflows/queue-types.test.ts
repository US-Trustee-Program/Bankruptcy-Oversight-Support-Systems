import { CamsError } from '../../common-errors/cams-error';
import { buildQueueError, QueueError } from './queue-types';

describe('Queue types', () => {
  test('buildQueueError', () => {
    const module = 'TEST_MODULE';
    const error: CamsError = new CamsError(module);
    const activityName = 'activity';

    const expected: QueueError = {
      activityName,
      error,
      module,
      type: 'QUEUE_ERROR',
    };

    expect(buildQueueError(error, module, activityName)).toEqual(expected);
  });
});
