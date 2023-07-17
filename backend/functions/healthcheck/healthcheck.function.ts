import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { httpError, httpSuccess } from '../lib/adapters/utils/http';

const NAMESPACE = 'HEALTH-CHECK-FUNCTION';

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest,
): Promise<void> {
  context.res = httpSuccess(context, { status: 'ALIVE' });
};

export default httpTrigger;
