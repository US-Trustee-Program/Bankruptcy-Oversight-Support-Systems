import { vi } from 'vitest';
import { createMockAzureFunctionRequest } from '../../azure/testing-helpers';
import { MongoCollectionAdapter } from '../../../lib/adapters/gateways/mongo/utils/mongo-adapter';

import { HealthCheckDocument } from './healthcheck.db.cosmos';
import handler, { checkResults } from './healthcheck.function';
import HealthcheckSqlDb from './healthcheck.db.sql';

const mockRequestFunc = vi.fn().mockImplementation(() => ({
  input: vi.fn(),
  query: mockQueryFunc,
}));
const mockCloseFunc = vi.fn();
const mockQueryFunc = vi.fn();
const mockConnect = vi.fn().mockImplementation(
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

vi.mock('mssql', () => {
  return {
    ConnectionPool: vi.fn().mockImplementation(() => {
      return {
        connect: mockConnect,
      };
    }),
  };
});

describe('healthcheck tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...process.env,
      INFO_VERSION: 'some-version',
      INFO_BRANCH: 'some-branch',
      INFO_SHA: 'some-sha',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  afterAll(() => {
    vi.resetAllMocks();
  });

  test('Healthcheck endpoint should return an ALIVE status', async () => {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const context = require('azure-function-context-mock');
    const request = createMockAzureFunctionRequest({ query: {} });
    vi.spyOn(MongoCollectionAdapter.prototype, 'getAll').mockResolvedValue([healthCheckDocument]);
    vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue('id');
    vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockResolvedValue(1);
    vi.spyOn(HealthcheckSqlDb.prototype, 'checkDxtrDbRead').mockResolvedValue(true);
    const response = await handler(request, context);

    expect(response.status).toEqual(200);
  }, 10000);

  test('Healthcheck info should use defaults', async () => {
    process.env = {
      ...process.env,
      INFO_VERSION: undefined,
      INFO_BRANCH: undefined,
      INFO_SHA: undefined,
    };
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const context = require('azure-function-context-mock');
    const request = createMockAzureFunctionRequest({ query: {} });
    vi.spyOn(MongoCollectionAdapter.prototype, 'getAll').mockResolvedValue([healthCheckDocument]);
    vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue('id');
    vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockResolvedValue(1);
    vi.spyOn(HealthcheckSqlDb.prototype, 'checkDxtrDbRead').mockResolvedValue(true);
    const response = await handler(request, context);

    expect(response.status).toEqual(200);
  }, 10000);

  test('Healthcheck endpoint should return an error response', async () => {
    /* eslint-disable-next-line @typescript-eslint/no-require-imports */
    const context = require('azure-function-context-mock');
    const request = createMockAzureFunctionRequest();
    vi.spyOn(MongoCollectionAdapter.prototype, 'getAll').mockResolvedValue([]);
    vi.spyOn(MongoCollectionAdapter.prototype, 'insertOne').mockResolvedValue('id');
    vi.spyOn(MongoCollectionAdapter.prototype, 'deleteOne').mockResolvedValue(1);
    const response = await handler(request, context);

    expect(response.status).toEqual(500);
  }, 10000);

  test('checkResults should return false when one result is false and true when all results are true', () => {
    expect(checkResults(false, true, true, true)).toBe(false);
    expect(checkResults(true, false, true, true)).toBe(false);
    expect(checkResults(true, true, false, true)).toBe(false);
    expect(checkResults(true, true, true, false)).toBe(false);
    expect(checkResults(true, true, true, true)).toBe(true);
  });
});
