import { UnauthorizedError } from './unauthorized-error';
import { getCamsError } from './error-utilities';
import { isCamsError } from './cams-error';
import HttpStatusCodes from '@common/api/http-status-codes';

const MODULE_NAME = 'test-module';
describe('error utilities tests', () => {
  test('should return the same error', () => {
    const error = new UnauthorizedError(MODULE_NAME);
    const actual = getCamsError(error, MODULE_NAME);
    expect(actual).toEqual(error);
    expect(isCamsError(actual)).toBeTruthy();
    expect(actual.status).toBe(HttpStatusCodes.UNAUTHORIZED);
  });

  test('should return an UnknownError', () => {
    const error = new Error('some error');
    const actual = getCamsError(error, MODULE_NAME);
    expect(actual).not.toEqual(error);
    expect(isCamsError(actual)).toBeTruthy();
    expect(actual.status).toBe(HttpStatusCodes.INTERNAL_SERVER_ERROR);
  });
});
