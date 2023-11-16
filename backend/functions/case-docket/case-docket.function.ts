import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import * as dotenv from 'dotenv';

import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import { CamsError } from '../lib/common-errors/cams-error';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { CaseDocketController } from '../lib/controllers/case-docket/case-docket.controller';

dotenv.config();

// enable instrumentation for Azure Application Insights
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  const appInsights = require('applicationinsights');
  appInsights.setup().start();
}

const MODULE_NAME = 'CASE-DOCKET-FUNCTION';

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
  } catch (originalError) {
    const camsError =
      originalError instanceof CamsError
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    applicationContext.logger.camsError(camsError);
    functionContext.res = httpError(camsError);
  }
};

export default httpTrigger;
