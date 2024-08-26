import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CasesController } from '../lib/controllers/cases/cases.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { isCamsError } from '../lib/common-errors/cams-error';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { CaseDetailsDbResult } from '../lib/adapters/types/cases';
import { initializeApplicationInsights } from '../azure/app-insights';
import { CaseBasics } from '../../../common/src/cams/cases';
import { ResponseBody } from '../../../common/src/api/response';
import { httpRequestToCamsHttpRequest } from '../azure/functions';

import * as dotenv from 'dotenv';
dotenv.config();

const MODULE_NAME = 'CASES-FUNCTION' as const;

initializeApplicationInsights();

export default async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const applicationContext = await ContextCreator.applicationContextCreator(
    invocationContext,
    request,
  );
  const casesController = new CasesController(applicationContext);

  type SearchResults = ResponseBody<CaseBasics[]>;

  try {
    applicationContext.session =
      await ContextCreator.getApplicationContextSession(applicationContext);

    let response: CaseDetailsDbResult | SearchResults;

    if (request.method === 'GET' && request.params.caseId) {
      response = await casesController.getCaseDetails({
        caseId: request.params.caseId,
      });
    } else {
      const camsRequest = await httpRequestToCamsHttpRequest(request);
      response = await casesController.searchCases(camsRequest);
    }

    return httpSuccess(response);
  } catch (originalError) {
    const error = isCamsError(originalError)
      ? originalError
      : new UnknownError(MODULE_NAME, { originalError });
    applicationContext.logger.camsError(error);
    return httpError(error);
  }
}

app.http('cases', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler,
  route: 'cases/{caseId?}',
});
