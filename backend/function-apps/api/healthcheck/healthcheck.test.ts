import { createMockAzureFunctionRequest } from '../../azure/testing-helpers';
import { MongoCollectionAdapter } from '../../../lib/adapters/gateways/mongo/utils/mongo-adapter';

import { HealthCheckDocument } from './healthcheck.db.cosmos';
import handler, { checkResults } from './healthcheck.function';

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

const healthCheckDocument: HealthCheckDocument = {
  id: 'some-id',
  healthCheckId: 'some-other-id',
  documentType: 'HEALTH_CHECK',
};

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
  const request = createMockAzureFunctionRequest({ query: {} });
  jest.spyOn(MongoCollectionAdapter.prototype, 'getAll').mockResolvedValue([healthCheckDocument]);
  jest.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue('id');
  jest.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockResolvedValue(1);
  await handler(request, context);

  expect(context.res.body).not.toBeNull(); // Check for any response.
}, 10000);

test('checkResults should return false when one result is false and true when all results are true', () => {
  expect(checkResults(false, true, true, true)).toBe(false);
  expect(checkResults(true, false, true, true)).toBe(false);
  expect(checkResults(true, true, false, true)).toBe(false);
  expect(checkResults(true, true, true, false)).toBe(false);
  expect(checkResults(true, true, true, true)).toBe(true);
});
