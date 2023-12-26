import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import { OfficesController } from '../lib/controllers/offices/offices.controller';
import { httpError, httpSuccess } from '../lib/adapters/utils/http-response';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  _officesRequest: HttpRequest,
): Promise<void> {
  const applicationContext = await applicationContextCreator(functionContext);
  const officesController = new OfficesController();

  // get the offices from region 2 and return
  try {
    const responseBody = await officesController.getOffices(applicationContext);
    functionContext.res = httpSuccess(responseBody);
  } catch (camsError) {
    applicationContext.logger.camsError(camsError);
    functionContext.res = httpError(camsError);
  }
};

export default httpTrigger;
