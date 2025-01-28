import { InvocationContext } from '@azure/functions';
import ContextCreator from '../azure/application-context-creator';
import { ApplicationContext } from '../../lib/adapters/types/basic';

async function getApplicationContext(
  invocationContext: InvocationContext,
): Promise<ApplicationContext> {
  const logger = ContextCreator.getLogger(invocationContext);
  const context = await ContextCreator.getApplicationContext({ invocationContext, logger });
  return context;
}

const PipelinesCommmon = {
  getApplicationContext,
};

export default PipelinesCommmon;
