import { AssignmentError } from './assignment.exception';
import HttpStatusCodes from '@common/api/http-status-codes';

describe('CAMS Assignment Exception', () => {
  const testModuleName = 'Test';
  test('assignmentError constructor', async () => {
    const error = new AssignmentError(testModuleName);
    expect(error.status).toBe(HttpStatusCodes.BAD_REQUEST);
    expect(error.module).toBe(testModuleName);
    expect(error.message).toBe('Unknown CAMS Error');
  });
});
