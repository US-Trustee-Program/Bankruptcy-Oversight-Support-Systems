import * as df from 'durable-functions';
import { InvocationContext, Timer } from '@azure/functions';
import { EXPORT_CASE_CHANGE_EVENTS } from './import-pipeline';

export default async function importPipelineTimerTrigger(
  _myTimer: Timer,
  context: InvocationContext,
) {
  const client = df.getClient(context);
  const _instanceId: string = await client.startNew(EXPORT_CASE_CHANGE_EVENTS);
}
