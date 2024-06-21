import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import { AttorneysController } from '../lib/controllers/attorneys/attorneys.controller';
import {
  applicationContextCreator,
  getApplicationContextSession,
} from '../lib/adapters/utils/application-context-creator';
import * as dotenv from 'dotenv';
import { isCamsError } from '../lib/common-errors/cams-error';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { initializeApplicationInsights } from '../azure/app-insights';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'ATTORNEYS-FUNCTION';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  request: HttpRequest,
): Promise<void> {
  const applicationContext = await applicationContextCreator(functionContext, request);
  const attorneysController = new AttorneysController(applicationContext);
  let officeId = '';

  if (request.query.office_id) officeId = request.query.office_id;
  else if (request.body && request.body.office_id) officeId = request.body.office_id;

  try {
    applicationContext.session = await getApplicationContextSession(applicationContext);
    const attorneysList = await attorneysController.getAttorneyList({ officeId });
    functionContext.res = httpSuccess(attorneysList);
  } catch (originalError) {
    const error = isCamsError(originalError)
      ? originalError
      : new UnknownError(MODULE_NAME, { originalError });
    applicationContext.logger.camsError(error);
    functionContext.res = httpError(error);
  }
};

export default httpTrigger;
