import CasesDxtrGateway from './cases.dxtr.gateway';
import { applicationContextCreator } from '../utils/application-context-creator';
import * as database from '../utils/database';
import { QueryResults } from '../types/database';

const context = require('azure-function-context-mock');
const appContext = applicationContextCreator(context);

const querySpy = jest.spyOn(database, 'executeQuery');

describe('Test DXTR Gateway', () => {
  test('returns a non empty list of chapter 15 cases when requested', async () => {
    const cases = [
      {
        caseNumber: 'case-one',
        caseTitle: 'Debtor One',
        dateFiled: '2018-11-16T00:00:00.000Z',
      },
      {
        caseNumber: 'case-two',
        caseTitle: 'Debtor Two',
        dateFiled: '2019-04-18T00:00:00.000Z',
      },
      {
        caseNumber: 'case-three',
        caseTitle: 'Debtor Three',
        dateFiled: '2019-04-18T00:00:00.000Z',
      },
    ];
    const mockResults: QueryResults = {
      success: true,
      results: cases,
      message: '',
    };
    querySpy.mockImplementation(async () => {
      return Promise.resolve(mockResults);
    });
    const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();
    const actualResult = await testCasesDxtrGateway.getChapter15Cases(appContext, {});
    expect(actualResult).not.toEqual(cases);
  });
});
