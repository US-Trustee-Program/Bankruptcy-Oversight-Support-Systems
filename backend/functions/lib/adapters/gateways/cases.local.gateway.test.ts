import { CasesLocalGateway } from './cases.local.gateway';
import { calculateDifferenceInMonths } from '../utils/date-helper';

const context = require('azure-function-context-mock');

describe('CasesLocalGateway tests', () => {
  test('should return data', async () => {
    const casesLocalGateway = new CasesLocalGateway();
    const startDate = new Date(2015, 1, 1);
    const startingMonth = 0 - calculateDifferenceInMonths(new Date(), startDate);
    const cases = await casesLocalGateway.getChapter15Cases(context, { startingMonth });
    expect(cases).toBeTruthy();
    expect(cases).not.toEqual([]);
  });
});
