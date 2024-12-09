import * as df from 'durable-functions';
import { HttpRequest, HttpResponse, InvocationContext } from '@azure/functions';
import { MAIN_ORCHESTRATOR } from '../loadConsolidations';
import { TriggerRequest } from '../../../lib/use-cases/acms-orders/acms-orders';
import { BadRequestError } from '../../../lib/common-errors/bad-request';
import * as dotenv from 'dotenv';
import { UnauthorizedError } from '../../../lib/common-errors/unauthorized-error';

const MODULE_NAME = 'ACMS_MIGRATION_TRIGGER';
dotenv.config();

export default async function httpStart(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponse> {
  const client = df.getClient(context);
  let params: TriggerRequest;
  if (request.body) {
    params = (await request.json()) as unknown as TriggerRequest;
  }

  if (!isTriggerRequest(params)) {
    throw new BadRequestError(MODULE_NAME, { message: 'Missing or malformed request body.' });
  }

  if (params.apiKey !== process.env.ADMIN_KEY) {
    throw new UnauthorizedError(MODULE_NAME, { message: 'API key was missing or did not match.' });
  }

  delete params.apiKey;
  const instanceId: string = await client.startNew(MAIN_ORCHESTRATOR, {
    input: params,
  });

  return client.createCheckStatusResponse(request, instanceId);
}

function isTriggerRequest(request: unknown): request is TriggerRequest {
  return (
    typeof request === 'object' &&
    'apiKey' in request &&
    'chapters' in request &&
    'divisionCodes' in request
  );
}
