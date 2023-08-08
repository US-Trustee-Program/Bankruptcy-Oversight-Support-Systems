import httpTrigger from './case.assignment.function';
import { applicationContextCreator } from '../lib/adapters/utils/application-context-creator';
const context = require('azure-function-context-mock');

const appContext = applicationContextCreator(context);
describe('Case Assignment Function Tests', () => {
  test('Return the assignment Id created for the new case assignment', async () => {
    const request = {
      query: {
        caseId: '6789',
        attorneyIdList: ['9082'],
        role: 'TrialAttorney',
      },
    };

    const expectedResponse = {
      assignmentIdList: [1],
      success: true,
      message: 'Trial attorney assignments created.',
      resultCount: 1,
    };
    await httpTrigger(appContext, request);
    expect(appContext.res.body).toEqual(expectedResponse);
  });
});
