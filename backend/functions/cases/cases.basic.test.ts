import httpTrigger from './cases.function';

const context = require('azure-function-context-mock');

jest.mock('../lib/adapters/controllers/cases.controller.ts', () => {
  return {
    CasesController: jest.fn().mockImplementation(() => {
      return {
        getCaseDetails: () => {
          return {
            message: '',
            success: true,
            body: {
              caseDetails: {
                caseId: '111-11-1111',
                caseTitle: '',
                dateFiled: '',
                dateClosed: '',
              },
            },
          };
        },
        getCaseList: (params: { caseChapter: string }) => {
          if (params.caseChapter === '15') {
            return {
              success: true,
              message: '',
              count: 2,
              body: {
                caseList: [
                  {
                    caseId: '081-11-06541',
                    caseTitle: 'Crawford, Turner and Garrett',
                    dateFiled: '2011-05-20',
                  },
                  {
                    caseId: '081-14-03544',
                    caseTitle: 'Ali-Cruz',
                    dateFiled: '2014-04-23',
                  },
                ],
              },
            };
          } else {
            const result = {
              success: false,
              message: 'Invalid Chapter value provided',
              count: 0,
              body: {
                caseList: [],
              },
            };
            return result;
          }
        },
      };
    }),
  };
});

describe('Standard case list tests without class mocks', () => {
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
      body: {
        caseDetails: {
          caseId: '111-11-1111',
          caseTitle: '',
          dateFiled: '',
          dateClosed: '',
        },
      },
    };

    await httpTrigger(context, request);

    expect(expectedResponseBody).toEqual(context.res.body);
  });
});
