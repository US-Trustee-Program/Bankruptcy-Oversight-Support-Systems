import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import * as dotenv from 'dotenv';

import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import { CaseDocketController } from '../lib/controllers/case-docket/case-docket.controller';
import { initializeApplicationInsights } from '../azure/app-insights';

dotenv.config();

initializeApplicationInsights();

//const MODULE_NAME = 'CASE-DOCKET-FUNCTION';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  caseDocketRequest: HttpRequest,
): Promise<void> {
  const applicationContext = await applicationContextCreator(functionContext);
  const caseDocketController = new CaseDocketController(applicationContext);
  try {
    const responseBody = await caseDocketController.getCaseDocket(applicationContext, {
      caseId: caseDocketRequest.params.caseId,
    });
    functionContext.res = httpSuccess(responseBody);
  } catch (camsError) {
    applicationContext.logger.camsError(camsError);
    functionContext.res = httpError(camsError);
  }
};

export default httpTrigger;
