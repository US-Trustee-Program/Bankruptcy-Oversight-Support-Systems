import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { httpError, httpSuccess } from '../lib/adapters/utils/http';
import { AttorneysController } from '../lib/adapters/controllers/attorneys.controller';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import log from '../lib/adapters/services/logger.service';
import * as dotenv from 'dotenv';

dotenv.config();

// enable instrumentation for Azure Application Insights
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  const appInsights = require('applicationinsights');
  appInsights.setup().start();
}

const MODULE_NAME = 'ATTORNEYS-FUNCTION';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  attorneysRequest: HttpRequest,
): Promise<void> {
  const attorneysController = new AttorneysController(functionContext);
  let officeId = '';

  if (attorneysRequest.query.office_id) officeId = attorneysRequest.query.office_id;
  else if (attorneysRequest.body && attorneysRequest.body.office_id)
    officeId = attorneysRequest.body.office_id;

  try {
    const attorneysList = await attorneysController.getAttorneyList({ officeId });
    functionContext.res = httpSuccess(functionContext, attorneysList);
  } catch (exception) {
    log.error(
      applicationContextCreator(functionContext),
      MODULE_NAME,
      exception.message,
      exception,
    );
    functionContext.res = httpError(functionContext, exception, 404);
  }
};

export default httpTrigger;
