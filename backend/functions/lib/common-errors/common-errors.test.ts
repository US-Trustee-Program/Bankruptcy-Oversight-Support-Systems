import { BadRequestError } from './bad-request';
import { CamsError, isCamsError } from './cams-error';
import {
  BAD_REQUEST,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  UNAUTHORIZED,
} from './constants';
import { ForbiddenError } from './forbidden-error';
import { NotFoundError } from './not-found-error';
import { ServerConfigError } from './server-config-error';
import { UnauthorizedError } from './unauthorized-error';
import { UnknownError } from './unknown-error';

describe('Common errors', () => {
  const testModuleName = 'Test';

  test('BadRequestError constructor', async () => {
    const error = new BadRequestError(testModuleName);
    expect(error.status).toBe(BAD_REQUEST);
    expect(error.module).toBe(testModuleName);
    expect(error.message).toBe('Bad request');
  });

  test('UnauthorizedError constructor', async () => {
    const error = new UnauthorizedError(testModuleName);
    expect(error.status).toBe(UNAUTHORIZED);
    expect(error.module).toBe(testModuleName);
    expect(error.message).toBe('Unauthorized');
  });

  test('ForbiddenError constructor', async () => {
    const error = new ForbiddenError(testModuleName);
    expect(error.status).toBe(FORBIDDEN);
    expect(error.module).toBe(testModuleName);
    expect(error.message).toBe('Request is Forbidden');
  });

  test('ServerConfigError constructor', async () => {
    const error = new ServerConfigError(testModuleName);
    expect(error.status).toBe(INTERNAL_SERVER_ERROR);
    expect(error.module).toBe(testModuleName);
    expect(error.message).toBe('Server configuration error');
  });

  test('UnknownError constructor', async () => {
    const error = new UnknownError(testModuleName);
    expect(error.status).toBe(INTERNAL_SERVER_ERROR);
    expect(error.module).toBe(testModuleName);
    expect(error.message).toBe('Unknown error');
  });

  test('NotFoundError constructor', async () => {
    const error = new NotFoundError(testModuleName);
    expect(error.status).toBe(NOT_FOUND);
    expect(error.module).toBe(testModuleName);
    expect(error.message).toBe('Not found');
  });

  test('isCamsError should return true for a CamsError and false otherwise', () => {
    const camsError = new CamsError(testModuleName);
    expect(isCamsError(camsError)).toBeTruthy();

    const negativeError = new Error();
    expect(isCamsError(negativeError)).toBeFalsy();
  });
});
