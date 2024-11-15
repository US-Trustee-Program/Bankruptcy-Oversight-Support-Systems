import { InvocationContext } from '@azure/functions';
import { PredicateAndPage } from '../model';

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
