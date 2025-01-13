import { CaseNotesForbidden, CaseNotesInvalid } from './case.notes.exception';
import HttpStatusCodes from '../../../../common/src/api/http-status-codes';

describe('CAMS Case Notes Exception', () => {
  const testModuleName = 'Test';
  test('caseNotesError constructor', async () => {
    const error = new CaseNotesForbidden(testModuleName);
    expect(error.status).toBe(HttpStatusCodes.FORBIDDEN);
    expect(error.module).toBe(testModuleName);
    expect(error.message).toBe('Unknown CAMS Error');
  });
  test('caseNotesInvalid constructor', async () => {
    const error = new CaseNotesInvalid(testModuleName);
    expect(error.status).toBe(HttpStatusCodes.BAD_REQUEST);
    expect(error.module).toBe(testModuleName);
    expect(error.message).toBe('Unknown CAMS Error');
  });
});
