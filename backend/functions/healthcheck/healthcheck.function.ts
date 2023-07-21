import log from '../lib/adapters/services/logger.service';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import { httpError, httpSuccess } from '../lib/adapters/utils/http';
import HealthcheckCosmoDb from './healthcheck.db';

import { AzureFunction, Context, HttpRequest } from '@azure/functions';

const NAMESPACE = 'HEALTHCHECK';

const httpTrigger: AzureFunction = async function (
  context: Context,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  req: HttpRequest,
): Promise<void> {
  const applicationContext = applicationContextCreator(context);
  const healthcheckCosmoDbClient = new HealthcheckCosmoDb(applicationContext);

  log.debug(applicationContext, NAMESPACE, 'Health check invoked');

  const checkCosmoDb = await healthcheckCosmoDbClient.check();
  log.debug(applicationContext, NAMESPACE, 'CosmoDb Check return ' + checkCosmoDb);

  const respBody = {
    cosmoDbStatus: checkCosmoDb,
  };

  const allCheckPassed = checkCosmoDb; // Add boolean flag for any other checks here
  context.res = allCheckPassed
    ? httpSuccess(context, { status: 'OK' })
    : httpError(context, new Error(JSON.stringify(respBody)), 500);
};

export default httpTrigger;
