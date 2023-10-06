import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { CasesController } from '../lib/adapters/controllers/cases.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import log from '../lib/adapters/services/logger.service';
import * as dotenv from 'dotenv';
import { CamsError } from '../lib/common-errors/cams-error';
import { UnknownError } from '../lib/common-errors/unknown-error';

dotenv.config();

// enable instrumentation for Azure Application Insights
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  const appInsights = require('applicationinsights');
  appInsights.setup().start();
}

const MODULE_NAME = 'CASES-FUNCTION';

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
      functionContext.res = httpSuccess(caseDetails);
    } else {
      if (casesRequest.query?.chapter) caseChapter = casesRequest.query.chapter;
      else if (casesRequest.body && casesRequest.body.chapter)
        caseChapter = casesRequest.body.chapter;

      const caseList = await casesController.getCaseList({
        caseChapter: caseChapter,
      });
      functionContext.res = httpSuccess(caseList);
    }
  } catch (originalError) {
    if (originalError instanceof CamsError) {
      functionContext.res = httpError(originalError);
      throw originalError;
    }
    const camsError = new UnknownError(MODULE_NAME, { originalError });
    log.camsError(applicationContextCreator(functionContext), camsError);
    functionContext.res = httpError(camsError);
  }
};

export default httpTrigger;
