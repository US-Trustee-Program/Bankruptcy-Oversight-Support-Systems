import { ResponseBodySuccess } from '../../../common/src/api/response';
import { CaseBasics } from '../../../common/src/cams/cases';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import httpTrigger from './cases.function';

const context = require('azure-function-context-mock');

const searchCasesResults = [MockData.getCaseBasics(), MockData.getCaseBasics()];

jest.mock('../lib/controllers/cases/cases.controller.ts', () => {
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
        searchCases: (_params: { caseNumber: string }): ResponseBodySuccess<CaseBasics[]> => {
          return {
            meta: {
              isPaginated: true,
              count: searchCasesResults.length,
              self: 'self-link',
              next: 'next-link',
              limit: 25,
              currentPage: 1,
            },
            isSuccess: true,
            data: searchCasesResults,
          };
        },
      };
    }),
  };
});

describe('Standard case list tests without class mocks', () => {
  beforeEach(() => {
    process.env = {
      FEATURE_FLAG_SDK_KEY: undefined,
    };
  });

  test('Should return 1 case when called with a caseId', async () => {
    const caseId = '081-11-06541';
    const request = {
      params: {
        caseId,
      },
      method: 'GET',
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

  test('should perform search', async () => {
    const caseNumber = '00-12345';
    const request = {
      params: {},
      query: {
        caseNumber,
      },
      method: 'GET',
    };

    const expectedResponseBody: ResponseBodySuccess<CaseBasics[]> = {
      meta: {
        isPaginated: true,
        count: searchCasesResults.length,
        self: 'self-link',
        next: 'next-link',
        limit: 25,
        currentPage: 1,
      },
      isSuccess: true,
      data: searchCasesResults,
    };

    await httpTrigger(context, request);

    expect(context.res.body).toEqual(expectedResponseBody);
  });
});
