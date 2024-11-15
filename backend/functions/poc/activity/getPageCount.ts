import { InvocationContext } from '@azure/functions';
import { PredicateAndPage } from '../model';

async function getPageCount(input: PredicateAndPage, context: InvocationContext) {
  // Do some stuff
  context.log('#################GetPageCount', JSON.stringify(input));
  return 4;
}

export default {
  handler: getPageCount,
};
