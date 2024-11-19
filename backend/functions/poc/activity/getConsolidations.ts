import { InvocationContext } from '@azure/functions';
import { PredicateAndPage } from '../../lib/use-cases/acms-orders/acms-orders';

async function getConsolidations(input: PredicateAndPage, context: InvocationContext) {
  // Do some stuff
  context.log('GetConsolidations', JSON.stringify(input));
  return [
    { orderId: '53rs2', caseId: '071-23-012345' },
    { orderId: '426gh', caseId: '071-23-43215' },
  ];
}

export default {
  handler: getConsolidations,
};
