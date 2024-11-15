import { InvocationContext } from '@azure/functions';
import { AcmsConsolidation } from '../model';
import { randomUUID } from 'crypto';

async function transformAndLoad(input: AcmsConsolidation, context: InvocationContext) {
  // Do some stuff
  context.log('#################Transform and load', JSON.stringify(input));
  const newOrder = {
    ...input,
    camsId: randomUUID(),
  };
  context.log(`Persisting ACMS consolidation ${newOrder.orderId} to CAMS ${newOrder.camsId}.`);
}

export default {
  handler: transformAndLoad,
};
