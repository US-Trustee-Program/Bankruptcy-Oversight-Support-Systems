import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { CasesController } from '../lib/adapters/controllers/cases.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import log from '../lib/adapters/services/logger.service';
import * as dotenv from 'dotenv';
import { CamsError } from '../lib/common-errors/cams-error';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { CaseDetailsDbResult, CaseListDbResult } from '../lib/adapters/types/cases';
import { initializeApplicationInsights } from '../azure/app-insights';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'CASES-FUNCTION';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  casesRequest: HttpRequest,
): Promise<void> {
  // Setup dependencies
  const applicationContext = await applicationContextCreator(functionContext);
  const casesController = new CasesController(applicationContext);

  // Process request message
  const caseId = casesRequest?.params?.caseId;

  try {
    let responseBody: CaseDetailsDbResult | CaseListDbResult;

    if (caseId) {
      // return case details
      responseBody = await casesController.getCaseDetails({
        caseId: casesRequest.params.caseId,
      });
    } else {
      // return list of all chapter cases
      responseBody = await casesController.getCases();
    }

    functionContext.res = httpSuccess(responseBody);
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
