import { Predicate, PredicateAndPage } from './model';

import * as df from 'durable-functions';

df.app.orchestration('subOrchestratorPaging', function* (context) {
  const predicate: Predicate = context.df.getInput();

  context.log('#################subOrchestratorPaging', JSON.stringify(predicate));

  const pageCount = yield context.df.callActivity('getPageCountFromACMS', predicate);
  context.log('#################pageCount', pageCount);
  const provisioningTasks = [];
  for (let pageNumber = 0; pageNumber < pageCount; pageNumber++) {
    const predicateAndPage: PredicateAndPage = {
      ...predicate,
      pageNumber,
    };
    const child_id = context.df.instanceId + `:${pageNumber}`;
    provisioningTasks.push(
      context.df.callSubOrchestrator('subOrchestratorETL', predicateAndPage, child_id),
    );
  }

  context.log('#################results', JSON.stringify(provisioningTasks));
  yield context.df.Task.all(provisioningTasks);
});
