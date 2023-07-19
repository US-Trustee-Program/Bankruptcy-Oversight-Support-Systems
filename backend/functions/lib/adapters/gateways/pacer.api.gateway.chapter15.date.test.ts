import { MockPacerApiGateway } from './mock-pacer.api.gateway';
import { CasesInterface } from '../../use-cases/cases.interface';
const context = require('azure-function-context-mock');

describe('Test the date filter on chapter 15 cases', () => {
  test('should return cases in the last 6 months when no starting month filter set', async () => {
    const today = new Date();
    const expectedStartDate = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate())
      .toISOString()
      .split('T')[0];

    const mockPacerApiGateway: CasesInterface = new MockPacerApiGateway();
    const actual = await mockPacerApiGateway.getChapter15Cases(context, {});

    function checkDate(aCase) {
      const verify = aCase.dateFiled >= expectedStartDate;
      return verify;
    }

    expect(actual.every(checkDate)).toBe(true);
  });

  test('should return cases as per the given starting month filter set', async () => {
    const testStartingMonthFilter = -60;
    const today = new Date();
    const expectedStartDate = new Date(
      today.getFullYear(),
      today.getMonth() + testStartingMonthFilter,
      today.getDate(),
    )
      .toISOString()
      .split('T')[0];
    const mockPacerApiGateway: CasesInterface = new MockPacerApiGateway();
    const actual = await mockPacerApiGateway.getChapter15Cases(context, {
      startingMonth: testStartingMonthFilter,
    });

    function checkDate(aCase) {
      const verify = aCase.dateFiled >= expectedStartDate;
      return verify;
    }

    expect(actual.every(checkDate)).toBe(true);
    expect(actual.length == 5);
  });
});
