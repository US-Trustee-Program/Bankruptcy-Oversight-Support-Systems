import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import * as dotenv from 'dotenv';

import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import {
  applicationContextCreator,
  getApplicationContextSession,
} from '../lib/adapters/utils/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { CaseAssociatedController } from '../lib/controllers/case-associated/case-associated.controller';

dotenv.config();

initializeApplicationInsights();

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  request: HttpRequest,
): Promise<void> {
  const applicationContext = await applicationContextCreator(functionContext, request);
  const controller = new CaseAssociatedController(applicationContext);

  try {
    applicationContext.session = await getApplicationContextSession(applicationContext);

    const responseBody = await controller.getAssociatedCases(applicationContext, {
      caseId: applicationContext.req.params.caseId,
    });
    functionContext.res = httpSuccess(responseBody);
  } catch (camsError) {
    applicationContext.logger.camsError(camsError);
    functionContext.res = httpError(camsError);
  }
};

export default httpTrigger;
