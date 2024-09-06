import ContextCreator from '../azure/application-context-creator';
import { CamsError } from '../lib/common-errors/cams-error';
import HealthcheckCosmosDb from './healthcheck.db.cosmos';

import { app, InvocationContext, HttpResponseInit, HttpRequest } from '@azure/functions';
import HealthcheckSqlDb from './healthcheck.db.sql';
import HealthcheckInfo from './healthcheck.info';
import { toAzureError, toAzureSuccess } from '../azure/functions';
import { httpSuccess } from '../lib/adapters/utils/http-response';
import HttpStatusCodes from '../../../common/src/api/http-status-codes';

const MODULE_NAME = 'HEALTHCHECK';

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);
  const applicationContext = await ContextCreator.getApplicationContext({
    invocationContext,
    logger,
    request,
  });
  const healthcheckCosmosDbClient = new HealthcheckCosmosDb(applicationContext);
  const healthCheckSqlDbClient = new HealthcheckSqlDb(applicationContext);

  applicationContext.logger.debug(MODULE_NAME, 'Health check endpoint invoked');

  const checkCosmosDbWrite = await healthcheckCosmosDbClient.checkDbWrite();
  applicationContext.logger.debug(MODULE_NAME, 'CosmosDb Write Check return ' + checkCosmosDbWrite);
  const checkCosmosDbRead = await healthcheckCosmosDbClient.checkDbRead();
  applicationContext.logger.debug(MODULE_NAME, 'CosmosDb Read Check return ' + checkCosmosDbRead);
  const checkCosmosDbDelete = await healthcheckCosmosDbClient.checkDbDelete();

  const checkSqlDbReadAccess = await healthCheckSqlDbClient.checkDxtrDbRead();
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
  return checkResults(
    checkCosmosDbWrite,
    checkCosmosDbRead,
    checkCosmosDbDelete,
    checkSqlDbReadAccess,
  )
    ? toAzureSuccess(
        httpSuccess({
          body: {
            data: Object.assign({ status: 'OK' }, respBody),
          },
        }),
      )
    : toAzureError(
        applicationContext,
        MODULE_NAME,
        new CamsError(MODULE_NAME, {
          message: JSON.stringify(respBody),
          status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
        }),
      );
}

export function checkResults(...results: boolean[]) {
  for (const i in results) {
    if (!results[i]) {
      return false;
    }
  }
  return true;
}

app.http('healthcheck', {
  methods: ['GET'],
  handler,
});
