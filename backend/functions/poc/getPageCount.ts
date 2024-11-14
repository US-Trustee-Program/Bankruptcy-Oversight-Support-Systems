import * as df from 'durable-functions';
import { InvocationContext } from '@azure/functions';
import { PredicateAndPage } from './model';

export default async function handler(input: PredicateAndPage, context: InvocationContext) {
  // Do some stuff
  context.log('GetPageCount', JSON.stringify(input));
  return 4;
}

df.app.activity('getPageCountFromACMS', {
  handler,
});
