import * as dotenv from 'dotenv';
import * as df from 'durable-functions';
import { HttpRequest, HttpResponse, InvocationContext } from '@azure/functions';
import { isAuthorized } from '../../../dataflows-common';
import { UnauthorizedError } from '../../../../../lib/common-errors/unauthorized-error';
import { TriggerRequest } from '../../../../../lib/use-cases/dataflows/migrate-consolidations';
import { BadRequestError } from '../../../../../lib/common-errors/bad-request';
import { toAzureError } from '../../../../azure/functions';
import ContextCreator from '../../../../azure/application-context-creator';
import { MAIN_ORCHESTRATOR } from '../migrate-consolidations-constants';

dotenv.config();

const MODULE_NAME = 'ACMS-MIGRATION-TRIGGER';

export default async function httpStart(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponse> {
  try {
    if (!isAuthorized(request)) {
      throw new UnauthorizedError(MODULE_NAME);
    }

    const client = df.getClient(context);
    let params: TriggerRequest;
    if (request.body) {
      params = (await request.json()) as unknown as TriggerRequest;
    }

    if (!isTriggerRequest(params)) {
      throw new BadRequestError(MODULE_NAME, { message: 'Missing or malformed request body.' });
    }

    const instanceId: string = await client.startNew(MAIN_ORCHESTRATOR, {
      input: params,
    });

    return client.createCheckStatusResponse(request, instanceId);
  } catch (error) {
    return new HttpResponse(toAzureError(ContextCreator.getLogger(context), MODULE_NAME, error));
  }
}

function isTriggerRequest(request: unknown): request is TriggerRequest {
  return typeof request === 'object' && 'chapters' in request && 'divisionCodes' in request;
}
