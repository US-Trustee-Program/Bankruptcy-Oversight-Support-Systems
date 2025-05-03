import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

import HttpStatusCodes from '../../../../common/src/api/http-status-codes';
import { httpSuccess } from '../../../lib/adapters/utils/http-response';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { closeDeferred } from '../../../lib/deferrable/defer-close';
import ContextCreator from '../../azure/application-context-creator';
import { toAzureError, toAzureSuccess } from '../../azure/functions';
import HealthcheckCosmosDb from './healthcheck.db.cosmos';
import HealthcheckSqlDb from './healthcheck.db.sql';
import HealthcheckInfo from './healthcheck.info';

const MODULE_NAME = 'HEALTHCHECK';

export function checkResults(...results: boolean[]) {
  for (const i in results) {
    if (!results[i]) {
      return false;
    }
  }
  return true;
}

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const context = await ContextCreator.getApplicationContext({
    invocationContext,
    request,
  });

  const healthcheckCosmosDbClient = new HealthcheckCosmosDb(context);
  const healthCheckSqlDbClient = new HealthcheckSqlDb(context);

  context.logger.debug(MODULE_NAME, 'Health check endpoint invoked');

  const cosmosStatus = await healthcheckCosmosDbClient.checkDocumentDb();

  Object.keys(cosmosStatus).forEach((key) => {
    context.logger.debug(MODULE_NAME, key + ': ' + cosmosStatus[key]);
  });
  const checkSqlDbReadAccess = await healthCheckSqlDbClient.checkDxtrDbRead();
  context.logger.debug(MODULE_NAME, 'SQL Dxtr Db Read Check return ' + checkSqlDbReadAccess);
  const healthcheckInfo = new HealthcheckInfo(context);
  const info = healthcheckInfo.getServiceInfo();

  const respBody = {
    database: {
      cosmosDbDeleteStatus: cosmosStatus.cosmosDbDeleteStatus,
      cosmosDbReadStatus: cosmosStatus.cosmosDbReadStatus,
      cosmosDbWriteStatus: cosmosStatus.cosmosDbWriteStatus,
      metadata: healthcheckCosmosDbClient.dbConfig(),
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
        context,
        MODULE_NAME,
        new CamsError(MODULE_NAME, {
          message: JSON.stringify(respBody),
          status: HttpStatusCodes.INTERNAL_SERVER_ERROR,
        }),
      );
  await closeDeferred(context);
  return result;
}

app.http('healthcheck', {
  handler,
  methods: ['GET'],
});
