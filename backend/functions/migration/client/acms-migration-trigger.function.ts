import * as df from 'durable-functions';
import { HttpRequest, HttpResponse, InvocationContext } from '@azure/functions';
import { MAIN_ORCHESTRATOR } from '../loadConsolidations';

export default async function httpStart(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponse> {
  const client = df.getClient(context);
  const body: unknown = await request.json();
  const instanceId: string = await client.startNew(MAIN_ORCHESTRATOR, {
    input: body,
  });

  context.log(`Started orchestration with ID = '${instanceId}'.`);

  return client.createCheckStatusResponse(request, instanceId);
}
