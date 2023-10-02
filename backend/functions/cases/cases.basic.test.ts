import httpTrigger from './cases.function';

const context = require('azure-function-context-mock');

describe('Standard case list tests without class mocks', () => {
  test('Should return 0 cases successfully when an invalid chapter parameter is provided', async () => {
    const request = {
      query: {
        chapter: '00',
      },
    };

    const responseBody = {
      success: false,
      message: 'Invalid Chapter value provided',
      count: 0,
      body: {
        caseList: [],
      },
    };

    await httpTrigger(context, request);

    expect(context.res.body).toEqual(responseBody);
  });
  test('Should return 1 case when called with a caseId', async () => {
    const caseId = '081-11-06541';
    const request = {
      params: {
        caseId,
      },
    };

    const responseBody = {
      success: true,
      message: '',
      count: 0,
      body: {
        case: {
          caseId: caseId,
          caseTitle: 'Crawford, Turner and Garrett',
          dateFiled: '2011-05-20',
          // assignments: ['', '', '', ''],
        },
      },
    };

    console.log(responseBody);
    await httpTrigger(context, request);
    console.log(context.res.body);
  });
});
