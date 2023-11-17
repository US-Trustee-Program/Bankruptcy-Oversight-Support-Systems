import { Context } from '@azure/functions';
import { ApplicationContext } from '../adapters/types/basic';
import { applicationContextCreator } from '../adapters/utils/application-context-creator';

// TODO: Need to refactor each test that needs an application context to use this convenience function.
export async function createMockApplicationContext(
  env: Record<string, string> = {},
): Promise<ApplicationContext> {
  process.env = env;
  return applicationContextCreator({} as unknown as Context);
}
