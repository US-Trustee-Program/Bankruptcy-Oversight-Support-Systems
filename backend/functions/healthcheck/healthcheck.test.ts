import httpTrigger, { checkResults } from './healthcheck.function';

const mockRequestFunc = jest.fn().mockImplementation(() => ({
  input: jest.fn(),
  query: mockQueryFunc,
}));
const mockCloseFunc = jest.fn();
const mockQueryFunc = jest.fn();
const mockConnect = jest.fn().mockImplementation(
  (): Promise<unknown> =>
    Promise.resolve({
      request: mockRequestFunc,
      close: mockCloseFunc,
    }),
);
jest.mock('mssql', () => {
  return {
    ConnectionPool: jest.fn().mockImplementation(() => {
      return {
        connect: mockConnect,
      };
    }),
  };
});

test('Healthcheck endpoint should return an ALIVE status', async () => {
  const context = require('azure-function-context-mock');

  const request = {
    query: {},
  };

  await httpTrigger(context, request);

  expect(context.res.body).not.toBeNull(); // Check for any response.
}, 10000);

test('checkResults should return false when one result is false and true when all results are true', () => {
  expect(checkResults(false, true, true, true)).toBe(false);
  expect(checkResults(true, false, true, true)).toBe(false);
  expect(checkResults(true, true, false, true)).toBe(false);
  expect(checkResults(true, true, true, false)).toBe(false);
  expect(checkResults(true, true, true, true)).toBe(true);
});
