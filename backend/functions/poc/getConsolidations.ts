import * as df from 'durable-functions';
import { InvocationContext } from '@azure/functions';
import { PredicateAndPage } from './model';

export default async function handler(input: PredicateAndPage, context: InvocationContext) {
  // Do some stuff
  context.log('GetConsolidations', JSON.stringify(input));
}

df.app.activity('getConsolidationsFromACMS', {
  // extraOutputs: [blobOutput],
  handler,
});
