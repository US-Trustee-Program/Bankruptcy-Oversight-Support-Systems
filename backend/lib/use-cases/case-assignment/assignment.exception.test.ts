import HttpStatusCodes from '../../../../common/src/api/http-status-codes';
import { AssignmentError } from './assignment.exception';

describe('CAMS Assignment Exception', () => {
  const testModuleName = 'Test';
  test('assignmentError constructor', async () => {
    const error = new AssignmentError(testModuleName);
    expect(error.status).toBe(HttpStatusCodes.BAD_REQUEST);
    expect(error.module).toBe(testModuleName);
    expect(error.message).toBe('Unknown CAMS Error');
  });
});
