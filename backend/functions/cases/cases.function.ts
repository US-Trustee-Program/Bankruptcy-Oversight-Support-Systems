import * as dotenv from 'dotenv';
import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { CasesController } from '../lib/controllers/cases/cases.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import {
  applicationContextCreator,
  getApplicationContextSession,
} from '../lib/adapters/utils/application-context-creator';
import { CamsError } from '../lib/common-errors/cams-error';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { CaseDetailsDbResult } from '../lib/adapters/types/cases';
import { initializeApplicationInsights } from '../azure/app-insights';
import { CaseBasics } from '../../../common/src/cams/cases';
import { ResponseBody } from '../../../common/src/api/response';
import { httpRequestToCamsHttpRequest } from '../azure/functions';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'CASES-FUNCTION';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  request: HttpRequest,
): Promise<void> {
  const applicationContext = await applicationContextCreator(functionContext);
  const casesController = new CasesController(applicationContext);

  type SearchResults = ResponseBody<CaseBasics[]>;

  try {
    applicationContext.session = await getApplicationContextSession(applicationContext.req);

    let responseBody: CaseDetailsDbResult | SearchResults;

    if (request.method === 'GET' && request.params.caseId) {
      responseBody = await casesController.getCaseDetails({
        caseId: request.params.caseId,
      });
    } else {
      const camsRequest = httpRequestToCamsHttpRequest(request);
      responseBody = await casesController.searchCases(camsRequest);
    }

    functionContext.res = httpSuccess(responseBody);
  } catch (originalError) {
    const error =
      originalError instanceof CamsError
        ? originalError
        : new UnknownError(MODULE_NAME, { originalError });
    applicationContext.logger.camsError(error);
    functionContext.res = httpError(error);
  }
};

export default httpTrigger;
