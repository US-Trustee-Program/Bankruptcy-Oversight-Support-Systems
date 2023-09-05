import CasesDxtrGateway from './cases.dxtr.gateway';
import { applicationContextCreator } from '../utils/application-context-creator';

const context = require('azure-function-context-mock');
const appContext = applicationContextCreator(context);

//const runQueryMock = jest.spyOn(dataUtils, 'executeQuery');
describe('Test DXTR Gateway', () => {
  /*
  xtest('Should return Chapter 15 cases when requested.', () => {
    // set the mock result for the query method
    querySpy.mockImplementation(() => Promise.resolve(mockDbResult as mssql.IResult<unknown>));

    runQueryMock.mockImplementation(() =>
      Promise.resolve({
        success: true,
        results: mockDbResult,
        message: 'Test Query',
      }),
    );

  });
  */

  test('returns a non empty list of chapter 15 cases when requested', async () => {
    const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();
    const actualResult = await testCasesDxtrGateway.getChapter15Cases(appContext, {});
    expect(actualResult).not.toEqual([]);
  });
});
