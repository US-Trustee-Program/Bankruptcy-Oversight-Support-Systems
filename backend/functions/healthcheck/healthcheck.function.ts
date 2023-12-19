import log from '../lib/adapters/services/logger.service';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import { CamsError } from '../lib/common-errors/cams-error';
import { INTERNAL_SERVER_ERROR } from '../lib/common-errors/constants';
import HealthcheckCosmosDb from './healthcheck.db.cosmos';

import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import HealthcheckSqlDb from './healthcheck.db.sql';

const MODULE_NAME = 'HEALTHCHECK';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  req: HttpRequest,
): Promise<void> {
  const applicationContext = await applicationContextCreator(functionContext);
  const healthcheckCosmosDbClient = new HealthcheckCosmosDb(applicationContext);
  const healthchechSqlDbClient = new HealthcheckSqlDb(applicationContext);

  log.debug(applicationContext, MODULE_NAME, 'Health check endpoint invoked');

  const checkCosmosDbWrite = await healthcheckCosmosDbClient.checkDbWrite();
  log.debug(applicationContext, MODULE_NAME, 'CosmosDb Write Check return ' + checkCosmosDbWrite);
  const checkCosmosDbRead = await healthcheckCosmosDbClient.checkDbRead();
  log.debug(applicationContext, MODULE_NAME, 'CosmosDb Read Check return ' + checkCosmosDbRead);
  const checkCosmosDbDelete = await healthcheckCosmosDbClient.checkDbDelete();

  const checkSqlDbReadAccess = await healthchechSqlDbClient.checkDxtrDbRead();
  log.debug(
    applicationContext,
    MODULE_NAME,
    'SQL Dxtr Db Read Check return ' + checkSqlDbReadAccess,
  );

  const respBody = {
    database: {
      cosmosDbWriteStatus: checkCosmosDbWrite,
      cosmosDbReadStatus: checkCosmosDbRead,
      cosmosDbDeleteStatus: checkCosmosDbDelete,
      sqlDbReadStatus: checkSqlDbReadAccess,
    },
  };

  // Add boolean flag for any other checks here
  functionContext.res = checkResults(
    checkCosmosDbWrite,
    checkCosmosDbRead,
    checkCosmosDbDelete,
    checkSqlDbReadAccess,
  )
    ? httpSuccess(Object.assign({ status: 'OK' }, respBody))
    : httpError(
        new CamsError(MODULE_NAME, {
          message: JSON.stringify(respBody),
          status: INTERNAL_SERVER_ERROR,
        }),
      );
};

export function checkResults(...results: boolean[]) {
  for (const i in results) {
    if (!results[i]) {
      return false;
    }
  }
  return true;
}

export default httpTrigger;
