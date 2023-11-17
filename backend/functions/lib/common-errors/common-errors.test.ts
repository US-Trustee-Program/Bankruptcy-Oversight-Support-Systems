import { FORBIDDEN, INTERNAL_SERVER_ERROR, NOT_FOUND } from './constants';
import { ForbiddenError } from './forbidden-error';
import { NotFoundError } from './not-found-error';
import { ServerConfigError } from './server-config-error';
import { UnknownError } from './unknown-error';

describe('Common errors', () => {
  const testModuleName = 'Test';
  test('ForbiddenError contructor', async () => {
    const error = new ForbiddenError(testModuleName);
    expect(error.status).toBe(FORBIDDEN);
    expect(error.module).toBe(testModuleName);
    expect(error.message).toBe('Request is Forbidden');
  });
  test('ServerConfigError contructor', async () => {
    const error = new ServerConfigError(testModuleName);
    expect(error.status).toBe(INTERNAL_SERVER_ERROR);
    expect(error.module).toBe(testModuleName);
    expect(error.message).toBe('Server configuration error');
  });
  test('UnknownError contructor', async () => {
    const error = new UnknownError(testModuleName);
    expect(error.status).toBe(INTERNAL_SERVER_ERROR);
    expect(error.module).toBe(testModuleName);
    expect(error.message).toBe('Unknown error');
  });
  test('NotFoundError contructor', async () => {
    const error = new NotFoundError(testModuleName);
    expect(error.status).toBe(NOT_FOUND);
    expect(error.module).toBe(testModuleName);
    expect(error.message).toBe('Not found');
  });
});
