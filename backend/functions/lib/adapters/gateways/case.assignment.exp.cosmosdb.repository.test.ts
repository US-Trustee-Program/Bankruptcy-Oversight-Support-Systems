import { applicationContextCreator } from '../utils/application-context-creator';
import { CaseAssignmentExpCosmosDbRepository } from './case.assignment.exp.cosmosdb.repository';
const functionContext = require('azure-function-context-mock');

describe('Experimental cosmosdb test', () => {
  test('Assignment request', async () => {
    const applicationContext = await applicationContextCreator(functionContext);
    const repository = new CaseAssignmentExpCosmosDbRepository(applicationContext);

    await repository.assignCase('111-22-12345', [{ role: 'Trial Attorney', name: 'Frankie' }]);
    await sleep(3000);

    await repository.assignCase('111-22-12345', [
      { role: 'Trial Attorney', name: 'Frankie' },
      { role: 'Trial Attorney', name: 'Mark' },
      { role: 'Trial Attorney', name: 'Joe' },
    ]);

    await sleep(3000);
    // The following is the where clause to get lastest assignment on the AssignmentHistory table
    // WHERE c.caseId = '111-22-12345' ORDER BY c.timestamp DESC OFFSET 0 LIMIT 1
    await repository.assignCase('111-22-12345', [{ role: 'Trial Attorney', name: 'Jane' }]);
  }, 15000);

  test('Clear container', async () => {
    const applicationContext = await applicationContextCreator(functionContext);
    const repository = new CaseAssignmentExpCosmosDbRepository(applicationContext);
    repository.clearContainer();
  });
});

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));
