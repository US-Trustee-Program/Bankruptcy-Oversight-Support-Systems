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

/*
  CAMS-193

  Expect to handle the following:
  - api/cases                    # Get all cases
  DONE - api/cases?chapter=15    # Get cases by chapter
  - api/cases?chapter=12         # Get cases by chapter
  DONE - api/cases/081-06-98043  # Get a case detail
*/

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  casesRequest: HttpRequest,
): Promise<void> {
  // Setup dependencies
  const applicationContext = await applicationContextCreator(functionContext);
  const casesController = new CasesController(applicationContext);

  // Process request message
  const caseId = casesRequest?.params?.caseId;
  const bankruptcyChapterNumber = casesRequest?.query?.chapter || casesRequest?.body?.chapter || '';

  try {
    if (caseId) {
      // return case details
      const caseDetails = await casesController.getCaseDetails({
        caseId: casesRequest.params.caseId,
      });
      functionContext.res = httpSuccess(caseDetails);
    } else if (bankruptcyChapterNumber) {
      // return cases by chapter
      const caseList = await casesController.getCaseList({
        caseChapter: bankruptcyChapterNumber,
      });
      functionContext.res = httpSuccess(caseList);
    } else {
      // return list of cases (no type filter)
      const caseList = await casesController.getAllCases();
      functionContext.res = httpSuccess(caseList);
    }
  } catch (originalError) {
    let error = originalError;
    if (!(error instanceof CamsError)) {
      error = new UnknownError(MODULE_NAME, { originalError });
    }
    log.camsError(applicationContext, error);
    functionContext.res = httpError(error);
  }
};

export default httpTrigger;
