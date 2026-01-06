import { BadRequestError } from './bad-request';
import { CamsError, isCamsError } from './cams-error';
import { ForbiddenError } from './forbidden-error';
import { NotFoundError } from './not-found-error';
import { ServerConfigError } from './server-config-error';
import { UnauthorizedError } from './unauthorized-error';
import { UnknownError } from './unknown-error';
import HttpStatusCodes from 'common/api/http-status-codes';

describe('Common errors', () => {
  const testModuleName = 'Test';

  const errorConstructorTestCases = [
    ['BadRequestError', BadRequestError, HttpStatusCodes.BAD_REQUEST, 'Bad request'],
    ['UnauthorizedError', UnauthorizedError, HttpStatusCodes.UNAUTHORIZED, 'Unauthorized'],
    ['ForbiddenError', ForbiddenError, HttpStatusCodes.FORBIDDEN, 'Request is Forbidden'],
    [
      'ServerConfigError',
      ServerConfigError,
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
      'Server configuration error',
    ],
    ['UnknownError', UnknownError, HttpStatusCodes.INTERNAL_SERVER_ERROR, 'Unknown Error'],
    ['NotFoundError', NotFoundError, HttpStatusCodes.NOT_FOUND, 'Not found'],
  ] as const;

  test.each(errorConstructorTestCases)(
    '%s constructor',
    async (_errorName, ErrorClass, expectedStatus, expectedMessage) => {
      const error = new ErrorClass(testModuleName);
      expect(error.status).toBe(expectedStatus);
      expect(error.module).toBe(testModuleName);
      expect(error.message).toBe(expectedMessage);
    },
  );

  test('isCamsError should return true for a CamsError and false otherwise', () => {
    const camsError = new CamsError(testModuleName);
    expect(isCamsError(camsError)).toBeTruthy();

    const negativeError = new Error();
    expect(isCamsError(negativeError)).toBeFalsy();
  });
});
