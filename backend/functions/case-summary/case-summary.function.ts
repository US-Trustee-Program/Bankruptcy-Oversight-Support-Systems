import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { CaseSummaryController } from '../lib/controllers/case-summary/case-summary.controller';
import { initializeApplicationInsights } from '../azure/app-insights';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { isCamsError } from '../lib/common-errors/cams-error';

const MODULE_NAME = 'CASE-SUMMARY-FUNCTION' as const;

initializeApplicationInsights();

export async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const applicationContext = await ContextCreator.applicationContextCreator(
    invocationContext,
    request,
  );
  const caseSummaryController = new CaseSummaryController(applicationContext);
  try {
    applicationContext.session =
      await ContextCreator.getApplicationContextSession(applicationContext);

    const response = await caseSummaryController.getCaseSummary(applicationContext, {
      caseId: request.params.caseId,
    });
    return httpSuccess(response);
  } catch (originalError) {
    const error = isCamsError(originalError)
      ? originalError
      : new UnknownError(MODULE_NAME, { originalError });
    applicationContext.logger.camsError(error);
    return httpError(error);
  }
}

export default handler;
