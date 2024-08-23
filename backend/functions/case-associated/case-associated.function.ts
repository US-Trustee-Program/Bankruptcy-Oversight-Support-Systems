import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { initializeApplicationInsights } from '../azure/app-insights';
import { CaseAssociatedController } from '../lib/controllers/case-associated/case-associated.controller';
import { isCamsError } from '../lib/common-errors/cams-error';
import { UnknownError } from '../lib/common-errors/unknown-error';

const MODULE_NAME = 'CASE-ASSOCIATED-FUNCTION' as const;

initializeApplicationInsights();

export async function handler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const applicationContext = await ContextCreator.applicationContextCreator(
    invocationContext,
    request,
  );
  const controller = new CaseAssociatedController(applicationContext);

  try {
    applicationContext.session =
      await ContextCreator.getApplicationContextSession(applicationContext);

    const response = await controller.getAssociatedCases(applicationContext, {
      caseId: applicationContext.request.params.caseId,
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
