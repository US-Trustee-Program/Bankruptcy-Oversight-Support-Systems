import { CasesLocalGateway } from './cases.local.gateway';
import { GatewayHelper } from './gateway-helper';

const context = require('azure-function-context-mock');
let gatewayHelper: GatewayHelper;

describe('CasesLocalGateway tests', () => {
  beforeEach(() => {
    gatewayHelper = new GatewayHelper();
  });

  test('should return data when passed starting month', async () => {
    const casesLocalGateway = new CasesLocalGateway();
    const startDate = new Date(2015, 1, 1);
    const startingMonth = 0 - gatewayHelper.calculateDifferenceInMonths(new Date(), startDate);
    const cases = await casesLocalGateway.getChapter15Cases(context, { startingMonth });
    expect(cases).toBeTruthy();
    expect(cases).not.toEqual([]);
  });

  test('should return empty array when not passed starting month', async () => {
    const excludedDate = new Date();
    excludedDate.setMonth(excludedDate.getMonth() - 6);
    excludedDate.setDate(excludedDate.getDate() - 1);
    const includedDate = new Date();
    includedDate.setMonth(includedDate.getMonth() - 6);
    gatewayHelper.chapter15MockExtract = () => {
      return [
        {
          caseNumber: '21-1234',
          caseTitle: 'Case A',
          dateFiled: excludedDate.toISOString().slice(0, 10),
        },
        {
          caseNumber: '21-4321',
          caseTitle: 'Case B',
          dateFiled: includedDate.toISOString().slice(0, 10),
        },
      ];
    };
    const casesLocalGateway = new CasesLocalGateway();
    const cases = await casesLocalGateway.getChapter15Cases(context, { gatewayHelper });
    expect(cases).toBeTruthy();
    expect(cases).toEqual([
      {
        caseNumber: '21-4321',
        caseTitle: 'Case B',
        dateFiled: includedDate.toISOString().slice(0, 10),
      },
    ]);
  });
});
