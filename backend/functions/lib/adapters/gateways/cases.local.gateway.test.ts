import { CasesLocalGateway } from './cases.local.gateway';
import { GatewayHelper } from './gateway-helper';

const context = require('azure-function-context-mock');
let gatewayHelper: GatewayHelper;

describe('CasesLocalGateway tests', () => {
  beforeAll(() => {
    gatewayHelper = new GatewayHelper();
  });

  test('should return data', async () => {
    const casesLocalGateway = new CasesLocalGateway();
    const startDate = new Date(2015, 1, 1);
    const startingMonth = 0 - gatewayHelper.calculateDifferenceInMonths(new Date(), startDate);
    const cases = await casesLocalGateway.getChapter15Cases(context, startingMonth);
    expect(cases).toBeTruthy();
    expect(cases).not.toEqual([]);
  });
});
