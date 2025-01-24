import * as df from 'durable-functions';
import { HttpRequest, HttpResponse, InvocationContext } from '@azure/functions';
import { DXTR_EXPORT_CASE_CHANGE_EVENTS } from './import-pipeline';
import { toAzureError } from '../../azure/functions';
import ContextCreator from '../../azure/application-context-creator';

const MODULE_NAME = 'IMPORT_PIPELINE_HTTP_TRIGGER';

export default async function importPipelineHttpTrigger(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponse> {
  try {
    const client = df.getClient(context);

    // TODO: Make sure we have a JWT with SuperAdmin role. Not API key.

    const instanceId: string = await client.startNew(DXTR_EXPORT_CASE_CHANGE_EVENTS);

    return client.createCheckStatusResponse(request, instanceId);
  } catch (error) {
    return new HttpResponse(toAzureError(ContextCreator.getLogger(context), MODULE_NAME, error));
  }
}
