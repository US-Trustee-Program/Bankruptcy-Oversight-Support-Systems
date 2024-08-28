import { ApplicationContext } from '../adapters/types/basic';
import { HttpRequest, InvocationContext } from '@azure/functions';
import { MockData } from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsSession } from '../../../../common/src/cams/session';
import { CamsHttpMethod, CamsHttpRequest } from '../adapters/types/http';
import ContextCreator from '../../azure/application-context-creator';

const invocationContext = new InvocationContext();

export async function createMockApplicationContext(
  env: Record<string, string> = {},
): Promise<ApplicationContext> {
  process.env = {
    DATABASE_MOCK: 'true',
    MOCK_AUTH: 'true',
    ...env,
  };
  return await ContextCreator.applicationContextCreator(invocationContext, createMockRequest());
}

export async function createMockApplicationContextSession(
  override: Partial<CamsSession> = {},
): Promise<CamsSession> {
  return MockData.getCamsSession(override);
}

export function createMockRequest(request: Partial<CamsHttpRequest> = {}): HttpRequest {
  const { headers, method, body, ...other } = request;
  const requestInit = {
    method: (method as CamsHttpMethod) ?? 'GET',
    url: 'http://localhost:3000',
    body: { string: JSON.stringify(body) },
    headers: { authorization: 'Bearer ' + MockData.getJwt(), ...headers },
    ...other,
  };
  return new HttpRequest(requestInit);
}
