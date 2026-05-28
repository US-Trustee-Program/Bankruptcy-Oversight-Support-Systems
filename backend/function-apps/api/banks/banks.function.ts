import { app } from '@azure/functions';
import { createControllerHandler } from '../../azure/functions';
import { BanksController } from '../../../lib/controllers/banks/banks.controller';
import { BankTrusteesController } from '../../../lib/controllers/bank-trustees/bank-trustees.controller';
import { BankHistoryController } from '../../../lib/controllers/bank-history/bank-history.controller';

const MODULE_NAME = 'BANKS-FUNCTION';

const handler = createControllerHandler(BanksController, MODULE_NAME);
export default handler;

export const trusteesHandler = createControllerHandler(BankTrusteesController, MODULE_NAME);

export const historyHandler = createControllerHandler(BankHistoryController, MODULE_NAME);

app.http('banks', {
  methods: ['GET', 'POST', 'PUT'],
  authLevel: 'anonymous',
  handler,
  route: 'banks/{bankId?}',
});

app.http('bank-trustees', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: trusteesHandler,
  route: 'banks/{bankId}/trustees',
});

app.http('bank-history', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: historyHandler,
  route: 'banks/{bankId}/history',
});
