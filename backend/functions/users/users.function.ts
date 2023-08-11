import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { UsersController } from '../lib/adapters/controllers/users.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import log from '../lib/adapters/services/logger.service';
import * as dotenv from 'dotenv';

dotenv.config();

// enable instrumentation for Azure Application Insights
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  const appInsights = require('applicationinsights');
  appInsights.start();
}

const NAMESPACE = 'USERS-FUNCTION';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  userRequest: HttpRequest,
): Promise<void> {
  const firstName =
    userRequest.query.first_name || (userRequest.body && userRequest.body.first_name);
  const lastName = userRequest.query.last_name || (userRequest.body && userRequest.body.last_name);
  const usersController = new UsersController(functionContext);

  const REQUIRED_PARAMETERS_MESSAGE = 'Required parameters absent: first_name and last_name.';
  try {
    if (firstName && lastName) {
      const user = await usersController.getUser({ firstName, lastName });
      functionContext.res = httpSuccess(functionContext, user);
    } else {
      log.error(applicationContextCreator(functionContext), NAMESPACE, REQUIRED_PARAMETERS_MESSAGE);
      functionContext.res = httpError(functionContext, new Error(REQUIRED_PARAMETERS_MESSAGE), 400);
    }
  } catch (exception) {
    functionContext.res = httpError(functionContext, exception, 404);
  }
};

export default httpTrigger;
