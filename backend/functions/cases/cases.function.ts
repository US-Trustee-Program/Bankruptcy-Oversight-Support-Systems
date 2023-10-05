import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { CasesController } from '../lib/adapters/controllers/cases.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http';
// import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
// import log from '../lib/adapters/services/logger.service';
import * as dotenv from 'dotenv';

dotenv.config();

// enable instrumentation for Azure Application Insights
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  const appInsights = require('applicationinsights');
  appInsights.setup().start();
}

// const NAMESPACE = 'CASES-FUNCTION';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  casesRequest: HttpRequest,
): Promise<void> {
  const casesController = new CasesController(functionContext);
  let caseChapter = '';

  try {
    if (casesRequest.params?.caseId) {
      const caseDetails = await casesController.getCaseDetails({
        caseId: casesRequest.params.caseId,
      });
      functionContext.res = httpSuccess(functionContext, caseDetails);
    } else {
      if (casesRequest.query?.chapter) caseChapter = casesRequest.query.chapter;
      else if (casesRequest.body && casesRequest.body.chapter)
        caseChapter = casesRequest.body.chapter;

      const caseList = await casesController.getCaseList({
        caseChapter: caseChapter,
      });
      functionContext.res = httpSuccess(functionContext, caseList);
    }
  } catch (exception) {
    // log.error(applicationContextCreator(functionContext), NAMESPACE, exception.message, exception);
    functionContext.res = httpError(functionContext, exception, 404);
  }
};

export default httpTrigger;
