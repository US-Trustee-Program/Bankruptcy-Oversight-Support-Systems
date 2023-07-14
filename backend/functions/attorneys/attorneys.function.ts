import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import log from '../lib/adapters/services/logger.service';
import { httpError, httpSuccess } from '../lib/adapters/utils/http';
import { AttorneysController } from '../lib/adapters/controllers/attorneys.controller';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';

const NAMESPACE = 'ATTORNEYS-FUNCTION';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  attorneysRequest: HttpRequest,
): Promise<void> {
  const attorneysController = new AttorneysController(functionContext);

  try {
    const caseList = await attorneysController.getAttorneyList({ officeId: '' });
    functionContext.res = httpSuccess(functionContext, caseList);
  } catch (exception) {
    log.error(applicationContextCreator(functionContext), NAMESPACE, exception.message, exception);
    functionContext.res = httpError(functionContext, exception, 404);
  }
};

export default httpTrigger;
