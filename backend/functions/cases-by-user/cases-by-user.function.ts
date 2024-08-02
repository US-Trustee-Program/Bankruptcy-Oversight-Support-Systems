import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { initializeApplicationInsights } from '../azure/app-insights';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { CasesController } from '../lib/controllers/cases/cases.controller';
import { httpRequestToCamsHttpRequest } from '../azure/functions';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import { isCamsError } from '../lib/common-errors/cams-error';
import { UnknownError } from '../lib/common-errors/unknown-error';

initializeApplicationInsights();

const MODULE_NAME = 'CASES-BY-USER-FUNCTION';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  request: HttpRequest,
): Promise<void> {
  const applicationContext = await ContextCreator.applicationContextCreator(
    functionContext,
    request,
  );
  const casesController = new CasesController(applicationContext);

  try {
    applicationContext.session =
      await ContextCreator.getApplicationContextSession(applicationContext);

    const camsRequest = httpRequestToCamsHttpRequest(request);
    const responseBody = await casesController.getCasesByUserSessionOffices(camsRequest);

    functionContext.res = httpSuccess(responseBody);
  } catch (originalError) {
    const error = isCamsError(originalError)
      ? originalError
      : new UnknownError(MODULE_NAME, { originalError });
    applicationContext.logger.camsError(error);
    functionContext.res = httpError(error);
  }
};

export default httpTrigger;
