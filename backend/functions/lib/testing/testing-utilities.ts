import { ApplicationContext } from '../adapters/types/basic';
import ContextCreator from '../adapters/utils/application-context-creator';
import { HttpRequest } from '@azure/functions';
import { MockData } from '../../../../common/src/cams/test-utilities/mock-data';
const functionContext = require('azure-function-context-mock');

export async function createMockApplicationContext(
  env: Record<string, string> = {},
): Promise<ApplicationContext> {
  process.env = {
    DATABASE_MOCK: 'true',
    MOCK_AUTH: 'true',
    ...env,
  };
  return await ContextCreator.applicationContextCreator(functionContext, createMockRequest());
}

export async function createMockApplicationContextSession() {
  return MockData.getCamsSession();
}

export function createMockRequest(request: Partial<HttpRequest> = {}): HttpRequest {
  const { headers, ...other } = request;
  return {
    method: 'GET',
    url: 'http://localhost:3000',
    headers: {
      authorization: 'Bearer ' + MockData.getJwt(),
      ...headers,
    },
    query: {},
    params: {},
    user: null,
    get: jest.fn(),
    parseFormBody: jest.fn(),
    ...other,
  };
}
