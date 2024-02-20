import * as dotenv from 'dotenv';
import { initializeApplicationInsights } from '../azure/app-insights';
import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
import { OrdersController } from '../lib/controllers/orders/orders.controller';
import { BadRequestError } from '../lib/common-errors/bad-request';
import { CamsError } from '../lib/common-errors/cams-error';
import { UnknownError } from '../lib/common-errors/unknown-error';
import { httpError } from '../lib/adapters/utils/http-response';

dotenv.config();

initializeApplicationInsights();

const MODULE_NAME = 'CONSOLIDATIONS-FUNCTION';

const httpTrigger: AzureFunction = async function (
  functionContext: Context,
  consolidationsRequest: HttpRequest,
): Promise<void> {
  const applicationContext = await applicationContextCreator(functionContext);
  const consolidationsController = new OrdersController(applicationContext);
  const procedure = consolidationsRequest?.params?.procedure;
  const body = consolidationsRequest?.body;

  try {
    if (procedure === 'reject') {
      await consolidationsController.rejectConsolidation(applicationContext, body);
    } else if (procedure === 'approve') {
      // handle approve
    } else {
      // error
      throw new BadRequestError(MODULE_NAME, {
        message: `Could not perform ${procedure}.`,
      });
    }
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
