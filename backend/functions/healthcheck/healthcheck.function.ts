import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import log from '../lib/adapters/services/logger.service';

const NAMESPACE = 'HEALTH-CHECK-FUNCTION';

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest,
): Promise<void> {
  log.info(context, NAMESPACE, 'HTTP Success');
  context.res = {
    headers: {
      'Content-Type': 'application/json',
      'Last-Modified': Date.toString(),
    },
    statusCode: 200,
    body: {
      status: 'ALIVE',
    },
  };
};

export default httpTrigger;
