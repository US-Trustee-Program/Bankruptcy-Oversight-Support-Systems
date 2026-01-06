import ContextCreator from '../../azure/application-context-creator';
import HealthcheckCosmosDb from './healthcheck.db.cosmos';

import { app, InvocationContext, HttpResponseInit, HttpRequest } from '@azure/functions';
import HealthcheckSqlDb from './healthcheck.db.sql';
import HealthcheckInfo from './healthcheck.info';
import { toAzureSuccess } from '../../azure/functions';
import { httpSuccess } from '../../../lib/adapters/utils/http-response';
import HttpStatusCodes from '@common/api/http-status-codes';
import { closeDeferred } from '../../../lib/deferrable/defer-close';

const MODULE_NAME = 'HEALTHCHECK';

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
      metadata: healthcheckCosmosDbClient.dbConfig(),
      cosmosDbWriteStatus: cosmosStatus.cosmosDbWriteStatus,
      cosmosDbReadStatus: cosmosStatus.cosmosDbReadStatus,
      cosmosDbDeleteStatus: cosmosStatus.cosmosDbDeleteStatus,
      sqlDbReadStatus: checkSqlDbReadAccess,
    },
    info,
  };

  await closeDeferred(context);

  // Add boolean flag for any other checks here
  const success = checkResults(
    cosmosStatus.cosmosDbDeleteStatus,
    cosmosStatus.cosmosDbReadStatus,
    cosmosStatus.cosmosDbWriteStatus,
    checkSqlDbReadAccess,
  );

  return toAzureSuccess(
    httpSuccess({
      body: {
        data: { status: success ? 'OK' : 'ERROR', ...respBody },
      },
      statusCode: success ? HttpStatusCodes.OK : HttpStatusCodes.INTERNAL_SERVER_ERROR,
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
