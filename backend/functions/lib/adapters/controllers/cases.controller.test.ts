import { CasesController } from './cases.controller';

const context = require('azure-function-context-mock');

describe('cases controller test', () => {
  test('should get list of chapter 15 cases for the given professional', async () => {
    const controller = new CasesController(context);
    const actual = controller.getCaseList({ caseChapter: '15', professionalId: '' });

    expect(actual).toEqual('');
  });
});
