import log from '../lib/adapters/services/logger.service';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import { httpError, httpSuccess } from '../lib/adapters/utils/http';
import HealthcheckCosmosDb from './healthcheck.db';

import { AzureFunction, Context, HttpRequest } from '@azure/functions';

const NAMESPACE = 'HEALTHCHECK';

const httpTrigger: AzureFunction = async function (
  context: Context,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  req: HttpRequest,
): Promise<void> {
  const applicationContext = applicationContextCreator(context);
  const healthcheckCosmosDbClient = new HealthcheckCosmosDb(applicationContext);

  log.debug(applicationContext, NAMESPACE, 'Health check invoked');

  const checkCosmosDb = await healthcheckCosmosDbClient.check();
  log.debug(applicationContext, NAMESPACE, 'CosmosDb Check return ' + checkCosmosDb);

  const respBody = {
    cosmosDbStatus: checkCosmosDb,
  };

  const allCheckPassed = checkCosmosDb; // Add boolean flag for any other checks here
  context.res = allCheckPassed
    ? httpSuccess(context, { status: 'OK' })
    : httpError(context, new Error(JSON.stringify(respBody)), 500);
};

export default httpTrigger;
