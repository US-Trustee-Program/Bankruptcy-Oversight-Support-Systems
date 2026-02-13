import { ApplicationContext } from '../adapters/types/basic';
import { HttpRequest, InvocationContext } from '@azure/functions';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsSession } from '@common/cams/session';
import { CamsHttpMethod, CamsHttpRequest } from '../adapters/types/http';
import ContextCreator from '../../function-apps/azure/application-context-creator';
import { LoggerImpl } from '../adapters/services/logger.service';
import { CamsError } from '../common-errors/cams-error';

const invocationContext = new InvocationContext();

export async function createMockApplicationContext<B = unknown>(
  args: {
    env?: Record<string, string>;
    request?: Partial<CamsHttpRequest<B>>;
  } = {},
): Promise<ApplicationContext<B>> {
  process.env = {
    ...process.env,
    DATABASE_MOCK: 'true',
    FEATURE_FLAG_SDK_KEY: undefined,
    CAMS_API_STORAGE_CONNECTION: 'UseDevelopmentStorage=true',
    CAMS_DATAFLOWS_STORAGE_CONNECTION: 'UseDevelopmentStorage=true',
    ...args.env,
  };

  const logger = new LoggerImpl('invocation-id');
  const context = await ContextCreator.getApplicationContext<B>({
    invocationContext,
    logger,
    request: createMockRequest(args.request),
  });
  context.session = await createMockApplicationContextSession();
  return context;
}

export async function createMockApplicationContextSession(
  override: Partial<CamsSession> = {},
): Promise<CamsSession> {
  return MockData.getCamsSession(override);
}

function createMockRequest(request: Partial<CamsHttpRequest> = {}): HttpRequest {
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

function convertError<T extends CamsError>(error: unknown): T {
  const camsError = {
    message: error['message'],
    status: error['status'],
    module: error['module'],
    originalError: error['originalError'],
    data: error['data'],
    isCamsError: error['isCamsError'],
    camsStack: error['camsStack'],
  };
  return camsError as T;
}

/**
 * getTheThrownError
 *
 * Use this function to return a thrown error so the error can be inspected with test `expect` specs.
 *
 * @param fn
 * @returns
 */
export async function getTheThrownError<T extends CamsError>(fn: () => unknown): Promise<T> {
  try {
    await fn();
    throw new Error('Expected error was not thrown.');
  } catch (e: unknown) {
    return convertError<T>(e);
  }
}
