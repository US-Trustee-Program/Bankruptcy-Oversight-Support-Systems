import { app, InvocationContext, HttpRequest } from '@azure/functions';
import { buildFunctionName, buildHttpTrigger } from '../dataflows-common';
import ContextCreator from '../../azure/application-context-creator';
import { ApplicationContext } from '../../../lib/adapters/types/basic';

const MODULE_NAME = 'LOAD-E2E-DB';
const HTTP_TRIGGER = buildFunctionName(MODULE_NAME, 'httpTrigger');

const httpTrigger = buildHttpTrigger(
  MODULE_NAME,
  async (invocationContext: InvocationContext, _request: HttpRequest) => {
    const context = await ContextCreator.getApplicationContext({ invocationContext });
    await clearDatabase(context);
    await loadData(context);
    return { status: 200 };
  },
);

async function clearDatabase(context: ApplicationContext) {
  const { clearAllCollections } = await import('./db-utils');
  await clearAllCollections(context);
}

async function loadData(context: ApplicationContext) {
  const DataGenerationUtils = (await import('./data-generation-utils')).default;
  await DataGenerationUtils.seedCosmosE2eDatabase(context);
}

function setup() {
  app.http(HTTP_TRIGGER, {
    route: 'load-e2e-db',
    methods: ['POST'],
    handler: httpTrigger,
  });
}

export default {
  MODULE_NAME,
  setup,
};
