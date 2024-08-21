import { ApplicationContext } from '../adapters/types/basic';
import ContextCreator from '../adapters/utils/application-context-creator';
import { HttpRequest } from '@azure/functions';
import { MockData } from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsSession } from '../../../../common/src/cams/session';
/* eslint-disable-next-line @typescript-eslint/no-require-imports */
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

export async function createMockApplicationContextSession(
  override: Partial<CamsSession> = {},
): Promise<CamsSession> {
  return MockData.getCamsSession(override);
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
