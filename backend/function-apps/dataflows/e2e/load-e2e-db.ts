import { app, HttpResponseInit, InvocationContext, HttpRequest } from '@azure/functions';
import { buildFunctionName } from '../dataflows-common';
import ContextCreator from '../../azure/application-context-creator';
import { ApplicationContext } from '../../../lib/adapters/types/basic';

const MODULE_NAME = 'LOAD-E2E-DB';
const HTTP_TRIGGER = buildFunctionName(MODULE_NAME, 'httpTrigger');

async function handleStart(
  _request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const context = await ContextCreator.getApplicationContext({ invocationContext });
  await clearDatabase(context);
  await loadData(context);
  return { status: 200 };
}

async function clearDatabase(context: ApplicationContext) {
  const { clearAllCollections } = await import('./db-utils');
  await clearAllCollections(context);
}

async function loadData(_context: ApplicationContext) {
  const { seedCosmosE2eDatabase } = await import('./data-generation-utils');
  await seedCosmosE2eDatabase();
}

function setup() {
  app.http(HTTP_TRIGGER, {
    route: 'load-e2e-db',
    methods: ['POST'],
    handler: handleStart,
  });
}

export default {
  MODULE_NAME,
  setup,
};
