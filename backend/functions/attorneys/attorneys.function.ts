import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import { AttorneysController } from '../lib/adapters/controllers/attorneys.controller';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import log from '../lib/adapters/services/logger.service';
import * as dotenv from 'dotenv';
import { CamsError } from '../lib/common-errors/cams-error';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { initializeApplicationInsights } from '../azure/app-insights';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'ATTORNEYS-FUNCTION';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  attorneysRequest: HttpRequest,
): Promise<void> {
  const applicationContext = await applicationContextCreator(functionContext);
  const attorneysController = new AttorneysController(applicationContext);
  let officeId = '';

  if (attorneysRequest.query.office_id) officeId = attorneysRequest.query.office_id;
  else if (attorneysRequest.body && attorneysRequest.body.office_id)
    officeId = attorneysRequest.body.office_id;

  try {
    const attorneysList = await attorneysController.getAttorneyList({ officeId });
    functionContext.res = httpSuccess(attorneysList);
  } catch (originalError) {
    const error =
      originalError instanceof CamsError
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    log.camsError(applicationContext, error);
    functionContext.res = httpError(error);
  }
};

export default httpTrigger;
