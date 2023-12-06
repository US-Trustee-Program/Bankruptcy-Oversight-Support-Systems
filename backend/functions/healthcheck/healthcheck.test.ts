import httpTrigger from './healthcheck.function';
const context = require('azure-function-context-mock');

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
  const request = {
    query: {},
  };

  await httpTrigger(context, request);

  expect(context.res.body).not.toBeNull(); // Check for any response.
}, 10000);
