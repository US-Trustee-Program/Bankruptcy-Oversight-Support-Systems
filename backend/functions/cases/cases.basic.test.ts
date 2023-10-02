import httpTrigger from './cases.function';

const context = require('azure-function-context-mock');

jest.mock('../lib/adapters/controllers/cases.controller.ts', () => {
  return {
    CasesController: jest.fn().mockImplementation(() => {
      return {
        getCaseDetails: () => {
          console.log('==== called the getCaseDetails mock');
          return {};
        },
        getCaseList: () => {
          console.log('==== called the getCaseList mock');
          return {};
        },
      };
    }),
  };
});

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

    const expectedResponseBody = {
      success: true,
      message: '',
      count: 0,
      body: {
        caseDetails: {
          caseId: '111-11-1111',
          caseTitle: '',
          dateFiled: '',
          dateClosed: '',
        },
      },
    };

    console.log(expectedResponseBody);

    await httpTrigger(context, request);
    //console.log(context.res.body);

    expect(expectedResponseBody).toEqual(context.res.body);
  });
});
