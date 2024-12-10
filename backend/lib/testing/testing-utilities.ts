import { ApplicationContext } from '../adapters/types/basic';
import { HttpRequest, InvocationContext } from '@azure/functions';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { CamsSession } from '../../../common/src/cams/session';
import { CamsHttpMethod, CamsHttpRequest } from '../adapters/types/http';
import ContextCreator from '../../function-apps/azure/application-context-creator';
import { LoggerImpl } from '../adapters/services/logger.service';

const invocationContext = new InvocationContext();

export async function createMockApplicationContext(
  args: {
    env?: Record<string, string>;
    request?: Partial<CamsHttpRequest>;
  } = {},
): Promise<ApplicationContext> {
  process.env = {
    ...process.env,
    DATABASE_MOCK: 'true',
    ...args.env,
  };

  const logger = new LoggerImpl('invocation-id');
  return await ContextCreator.applicationContextCreator(
    invocationContext,
    logger,
    createMockRequest(args.request),
  );
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
