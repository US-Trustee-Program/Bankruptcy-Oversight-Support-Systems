import { ApplicationContext } from '../adapters/types/basic';
import { MockData } from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsSession } from '../../../../common/src/cams/session';
import { CamsHttpMethod, CamsHttpRequest } from '../adapters/types/http';
import { LoggerImpl } from '../adapters/services/logger.service';
import { ApplicationConfiguration } from '../configs/application-configuration';
import { randomUUID } from 'crypto';

export async function createMockApplicationContext(
  args: {
    env?: Record<string, string>;
    request?: Partial<CamsHttpRequest>;
    session?: Partial<CamsSession>;
  } = {},
): Promise<ApplicationContext> {
  process.env = {
    DATABASE_MOCK: 'true',
    ...args.env,
  };

  const config = new ApplicationConfiguration();
  const logger = new LoggerImpl('invocation-id', console.log);
  const { headers, method, body, ...other } = args.request ?? {};
  const request = {
    method: (method as CamsHttpMethod) ?? 'GET',
    url: 'http://localhost:3000',
    headers: { authorization: 'Bearer ' + MockData.getJwt(), ...headers },
    query: {},
    params: {},
    body: { string: JSON.stringify(body) },
    ...other,
  };

  const context = {
    config,
    featureFlags: {},
    logger,
    invocationId: randomUUID(),
    request,
    session: MockData.getCamsSession(args.session),
  } satisfies ApplicationContext;
  return Promise.resolve(context);
}

export async function createMockApplicationContextSession(
  override: Partial<CamsSession> = {},
): Promise<CamsSession> {
  return MockData.getCamsSession(override);
}
