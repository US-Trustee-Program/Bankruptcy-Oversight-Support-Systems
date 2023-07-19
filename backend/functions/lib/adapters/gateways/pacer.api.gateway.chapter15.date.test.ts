import { MockPacerApiGateway } from './mock-pacer.api.gateway';
import { CasesInterface } from '../../use-cases/cases.interface';
import { getCamsDateStringFromDate } from '../utils/date-helper';
const context = require('azure-function-context-mock');

describe('Test the date filter on chapter 15 cases', () => {
  test('should return cases in the last 6 months when no starting month filter set', async () => {
    const today = new Date();
    const expectedStartDate = getCamsDateStringFromDate(
      new Date(today.getFullYear(), today.getMonth() - 6, today.getDate()),
    );

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
    const expectedStartDate = new Date();
    expectedStartDate.setMonth(expectedStartDate.getMonth() + testStartingMonthFilter);
    const mockPacerApiGateway: CasesInterface = new MockPacerApiGateway();
    const actual = await mockPacerApiGateway.getChapter15Cases(context, {
      startingMonth: testStartingMonthFilter,
    });

    function checkDate(aCase) {
      const verify = aCase.dateFiled >= getCamsDateStringFromDate(expectedStartDate);
      return verify;
    }

    expect(actual.every(checkDate)).toBe(true);
    expect(actual.length == 5);
  });
});
