import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { httpSuccess } from '../lib/adapters/utils/http';

const httpTrigger: AzureFunction = async function (
  context: Context,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  req: HttpRequest,
): Promise<void> {
  context.res = httpSuccess(context, { status: 'ALIVE' });
};

export default httpTrigger;
