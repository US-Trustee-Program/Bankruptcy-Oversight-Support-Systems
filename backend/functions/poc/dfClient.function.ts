import * as df from 'durable-functions';
import { app, HttpRequest, HttpResponse, InvocationContext } from '@azure/functions';

export default async function httpStart(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponse> {
  const client = df.getClient(context);
  const body: unknown = await request.json();
  const instanceId: string = await client.startNew('orchestrator', {
    input: body,
  });

  context.log(`Started orchestration with ID = '${instanceId}'.`);

  return client.createCheckStatusResponse(request, instanceId);
}

app.http('dfClient', {
  route: 'orchestrators/orchestrator',
  extraInputs: [df.input.durableClient()],
  handler: httpStart,
});
