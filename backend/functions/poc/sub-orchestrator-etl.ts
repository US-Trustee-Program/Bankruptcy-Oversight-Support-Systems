import { PredicateAndPage } from './model';

import * as df from 'durable-functions';

df.app.orchestration('subOrchestratorETL', function* (context) {
  const predicateAndPage: PredicateAndPage = context.df.getInput();

  context.log(
    '#################subOrchestratorETL:',
    context.df.instanceId,
    JSON.stringify(predicateAndPage),
  );

  const consolidatedOrdersPage = yield context.df.callActivity(
    'getConsolidationsFromACMS',
    predicateAndPage,
  );

  context.log('#################length', consolidatedOrdersPage.length);
  const parallelTasks = [];
  for (let i = 0; i < consolidatedOrdersPage.length; i++) {
    parallelTasks.push(context.df.callActivity('transformAndLoad', consolidatedOrdersPage[i]));
  }

  yield context.df.Task.all(parallelTasks);

  // DO we need to fan in??
  // const sum = parallelTasks.reduce((prev, curr) => prev + curr, 0);
  // yield context.df.callActivity('finalResults??', sum);
});
