import { AssignmentError } from './assignment.exception';
import { BAD_REQUEST } from '../common-errors/constants';

describe('CAMS Assignment Exception', () => {
  const testModuleName = 'Test';
  test('assignmentError contructor', async () => {
    const error = new AssignmentError(testModuleName);
    expect(error.status).toBe(BAD_REQUEST);
    expect(error.module).toBe(testModuleName);
    expect(error.message).toBe('Unknown CAMS Error');
  });
});
