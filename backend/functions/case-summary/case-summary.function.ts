import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import * as dotenv from 'dotenv';

import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import {
  applicationContextCreator,
  getApplicationContextSession,
} from '../lib/adapters/utils/application-context-creator';
import { CaseSummaryController } from '../lib/controllers/case-summary/case-summary.controller';
import { initializeApplicationInsights } from '../azure/app-insights';

dotenv.config();

initializeApplicationInsights();

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  request: HttpRequest,
): Promise<void> {
  const applicationContext = await applicationContextCreator(functionContext);
  const caseSummaryController = new CaseSummaryController(applicationContext);
  try {
    applicationContext.session = await getApplicationContextSession(applicationContext);

    const responseBody = await caseSummaryController.getCaseSummary(applicationContext, {
      caseId: request.params.caseId,
    });
    functionContext.res = httpSuccess(responseBody);
  } catch (camsError) {
    applicationContext.logger.camsError(camsError);
    functionContext.res = httpError(camsError);
  }
};

export default httpTrigger;
