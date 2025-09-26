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
  return Promise.resolve({ status: 200 });
}

async function clearDatabase(_context: ApplicationContext) {
  // Guard: Only allow if database name includes 'e2e'.
  const dbName = _context.config.documentDbConfig.databaseName;
  if (!dbName || !dbName.toLowerCase().includes('e2e')) {
    throw new Error(`Refusing to clear database: '${dbName}' does not include 'e2e'`);
  }
  // Delete all documents from all collections in the MongoDB database.
  return Promise.reject('Not implemented');
}

async function loadData(_context: ApplicationContext) {
  // Execute load-cosmos-data.ts
  return Promise.reject('Not implemented');
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
