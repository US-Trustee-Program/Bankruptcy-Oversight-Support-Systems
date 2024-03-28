import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import { CamsError } from '../lib/common-errors/cams-error';
import { INTERNAL_SERVER_ERROR } from '../lib/common-errors/constants';
import HealthcheckCosmosDb from './healthcheck.db.cosmos';

import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import HealthcheckSqlDb from './healthcheck.db.sql';
import HealthcheckInfo from './healthcheck.info';

const MODULE_NAME = 'HEALTHCHECK';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  _req: HttpRequest,
): Promise<void> {
  const applicationContext = await applicationContextCreator(functionContext);
  const healthcheckCosmosDbClient = new HealthcheckCosmosDb(applicationContext);
  const healthchechSqlDbClient = new HealthcheckSqlDb(applicationContext);

  applicationContext.logger.debug(MODULE_NAME, 'Health check endpoint invoked');

  const checkCosmosDbWrite = await healthcheckCosmosDbClient.checkDbWrite();
  applicationContext.logger.debug(MODULE_NAME, 'CosmosDb Write Check return ' + checkCosmosDbWrite);
  const checkCosmosDbRead = await healthcheckCosmosDbClient.checkDbRead();
  applicationContext.logger.debug(MODULE_NAME, 'CosmosDb Read Check return ' + checkCosmosDbRead);
  const checkCosmosDbDelete = await healthcheckCosmosDbClient.checkDbDelete();

  const checkSqlDbReadAccess = await healthchechSqlDbClient.checkDxtrDbRead();
  applicationContext.logger.debug(
    MODULE_NAME,
    'SQL Dxtr Db Read Check return ' + checkSqlDbReadAccess,
  );

  const healthcheckInfo = new HealthcheckInfo(applicationContext);
  const info = healthcheckInfo.getServiceInfo();

  const respBody = {
    database: {
      metadata: healthcheckCosmosDbClient.dbConfig(),
      cosmosDbWriteStatus: checkCosmosDbWrite,
      cosmosDbReadStatus: checkCosmosDbRead,
      cosmosDbDeleteStatus: checkCosmosDbDelete,
      sqlDbReadStatus: checkSqlDbReadAccess,
    },
    info,
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
