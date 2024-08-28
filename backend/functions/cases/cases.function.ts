import * as dotenv from 'dotenv';
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CasesController } from '../lib/controllers/cases/cases.controller';
import ContextCreator from '../azure/application-context-creator';
import { CaseDetailsDbResult } from '../lib/adapters/types/cases';
import { initializeApplicationInsights } from '../azure/app-insights';
import { CaseBasics } from '../../../common/src/cams/cases';
import { ResponseBody } from '../../../common/src/api/response';
import { toAzureError, toAzureSuccess } from '../azure/functions';

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

    if (request.method === 'GET' && applicationContext.request.params.caseId) {
      response = await casesController.getCaseDetails({
        caseId: applicationContext.request.params.caseId,
      });
    } else {
      response = await casesController.searchCases(applicationContext.request);
    }

    return toAzureSuccess(response);
  } catch (error) {
    return toAzureError(applicationContext, MODULE_NAME, error);
  }
}

app.http('cases', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler,
  route: 'cases/{caseId?}',
});
