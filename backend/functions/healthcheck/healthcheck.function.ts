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

  log.debug(applicationContext, NAMESPACE, 'Health check enpoint invoked');

  const checkCosmosDbWrite = await healthcheckCosmosDbClient.checkDbWrite();
  log.debug(applicationContext, NAMESPACE, 'CosmosDb Write Check return ' + checkCosmosDbWrite);
  const checkCosmosDbRead = await healthcheckCosmosDbClient.checkDbRead();
  log.debug(applicationContext, NAMESPACE, 'CosmosDb Read Check return ' + checkCosmosDbRead);
  const checkCosmosDbDelete = await healthcheckCosmosDbClient.checkDbDelete();

  const respBody = {
    cosmosDbWriteStatus: checkCosmosDbWrite,
    cosmosDbReadStatus: checkCosmosDbRead,
    cosmosDbDeleteStatus: checkCosmosDbDelete,
  };

  // Add boolean flag for any other checks here
  const allCheckPassed = checkCosmosDbWrite && checkCosmosDbRead && checkCosmosDbDelete;

  context.res = allCheckPassed
    ? httpSuccess(context, { status: 'OK' })
    : httpError(context, new Error(JSON.stringify(respBody)), 500);
};

export default httpTrigger;
