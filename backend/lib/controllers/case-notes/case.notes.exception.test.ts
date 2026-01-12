import { ForbiddenCaseNotesError, InvalidCaseNotesError } from './case.notes.exception';
import HttpStatusCodes from '@common/api/http-status-codes';

describe('CAMS Case Notes Exception', () => {
  const testModuleName = 'Test';
  test('ForbiddenCaseNotesError constructor', async () => {
    const error = new ForbiddenCaseNotesError(testModuleName);
    expect(error.status).toBe(HttpStatusCodes.FORBIDDEN);
    expect(error.module).toBe(testModuleName);
    expect(error.message).toBe('Unknown CAMS Error');
  });
  test('InvalidCaseNotesError constructor', async () => {
    const error = new InvalidCaseNotesError(testModuleName);
    expect(error.status).toBe(HttpStatusCodes.BAD_REQUEST);
    expect(error.module).toBe(testModuleName);
    expect(error.message).toBe('Unknown CAMS Error');
  });
});
