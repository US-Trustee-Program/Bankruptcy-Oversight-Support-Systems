import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import ContextCreator from '../lib/adapters/utils/application-context-creator';
import { OfficesController } from '../lib/controllers/offices/offices.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';
import { httpRequestToCamsHttpRequest } from '../azure/functions';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  request: HttpRequest,
): Promise<void> {
  const applicationContext = await ContextCreator.applicationContextCreator(
    functionContext,
    request,
  );
  const officesController = new OfficesController(applicationContext);

  try {
    applicationContext.session =
      await ContextCreator.getApplicationContextSession(applicationContext);

    const camsRequest = httpRequestToCamsHttpRequest(request);
    const responseBody = await officesController.getOffices(camsRequest);
    functionContext.res = httpSuccess(responseBody);
  } catch (camsError) {
    applicationContext.logger.camsError(camsError);
    functionContext.res = httpError(camsError);
  }
};

export default httpTrigger;
