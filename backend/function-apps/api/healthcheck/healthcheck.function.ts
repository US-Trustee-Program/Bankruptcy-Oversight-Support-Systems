import ContextCreator from '../../azure/application-context-creator';
import { CamsError } from '../../../lib/common-errors/cams-error';
import HealthcheckCosmosDb from './healthcheck.db.cosmos';

import { app, InvocationContext, HttpResponseInit, HttpRequest } from '@azure/functions';
import HealthcheckSqlDb from './healthcheck.db.sql';
import HealthcheckInfo from './healthcheck.info';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import { httpSuccess } from '../../../lib/adapters/utils/http-response';
import HttpStatusCodes from '../../../../common/src/api/http-status-codes';
import { closeDeferred } from '../../../lib/deferrable/defer-close';

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

  const cosmosStatus = await healthcheckCosmosDbClient.checkDocumentDb();

  Object.keys(cosmosStatus).forEach((key) => {
    applicationContext.logger.debug(MODULE_NAME, key + ': ' + cosmosStatus[key]);
  });
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
      cosmosDbWriteStatus: cosmosStatus.cosmosDbWriteStatus,
      cosmosDbReadStatus: cosmosStatus.cosmosDbReadStatus,
      cosmosDbDeleteStatus: cosmosStatus.cosmosDbDeleteStatus,
      sqlDbReadStatus: checkSqlDbReadAccess,
    },
    info,
  };

  // Add boolean flag for any other checks here
  const result = checkResults(
    cosmosStatus.cosmosDbDeleteStatus,
    cosmosStatus.cosmosDbReadStatus,
    cosmosStatus.cosmosDbWriteStatus,
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
  await closeDeferred(applicationContext);
  return result;
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