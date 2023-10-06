import log from '../lib/adapters/services/logger.service';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-client';
import { CamsError } from '../lib/common-errors/cams-error';
import { INTERNAL_SERVER_ERROR } from '../lib/common-errors/constants';
import HealthcheckCosmosDb from './healthcheck.db';

import { AzureFunction, Context, HttpRequest } from '@azure/functions';

const MODULE_NAME = 'HEALTHCHECK';

const httpTrigger: AzureFunction = async function (
  context: Context,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  req: HttpRequest,
): Promise<void> {
  const applicationContext = applicationContextCreator(context);
  const healthcheckCosmosDbClient = new HealthcheckCosmosDb(applicationContext);

  log.debug(applicationContext, MODULE_NAME, 'Health check endpoint invoked');

  const checkCosmosDbWrite = await healthcheckCosmosDbClient.checkDbWrite();
  log.debug(applicationContext, MODULE_NAME, 'CosmosDb Write Check return ' + checkCosmosDbWrite);
  const checkCosmosDbRead = await healthcheckCosmosDbClient.checkDbRead();
  log.debug(applicationContext, MODULE_NAME, 'CosmosDb Read Check return ' + checkCosmosDbRead);
  const checkCosmosDbDelete = await healthcheckCosmosDbClient.checkDbDelete();

  const respBody = {
    cosmosDbWriteStatus: checkCosmosDbWrite,
    cosmosDbReadStatus: checkCosmosDbRead,
    cosmosDbDeleteStatus: checkCosmosDbDelete,
  };

  // Add boolean flag for any other checks here
  const allCheckPassed = checkCosmosDbWrite && checkCosmosDbRead && checkCosmosDbDelete;

  context.res = allCheckPassed
    ? httpSuccess({ status: 'OK' })
    : httpError(
        new CamsError(MODULE_NAME, {
          message: JSON.stringify(respBody),
          status: INTERNAL_SERVER_ERROR,
        }),
      );
};

export default httpTrigger;
