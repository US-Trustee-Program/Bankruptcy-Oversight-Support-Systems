import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import * as dotenv from 'dotenv';

import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import { CaseHistoryController } from '../lib/controllers/case-history/case-history.controller';
import { initializeApplicationInsights } from '../azure/app-insights';

dotenv.config();

initializeApplicationInsights();

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  caseHistoryRequest: HttpRequest,
): Promise<void> {
  const applicationContext = await applicationContextCreator(functionContext);
  const caseHistoryController = new CaseHistoryController(applicationContext);
  try {
    const responseBody = await caseHistoryController.getCaseHistory(applicationContext, {
      caseId: caseHistoryRequest.params.caseId,
    });
    functionContext.res = httpSuccess(responseBody);
  } catch (camsError) {
    applicationContext.logger.camsError(camsError);
    functionContext.res = httpError(camsError);
  }
};

export default httpTrigger;
