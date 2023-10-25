import { CasesController } from './cases.controller';

const context = require('azure-function-context-mock');

const caseId1 = '081-11-06541';
const caseId2 = '081-14-03544';

const expectedListResult = {
  success: true,
  message: '',
  count: 2,
  body: {
    caseList: [
      {
        caseId: caseId2,
        caseTitle: 'Crawford, Turner and Garrett',
        dateFiled: '05-20-2011',
      },
      {
        caseId: caseId1,
        caseTitle: 'Ali-Cruz',
        dateFiled: '04-23-2014',
      },
    ],
  },
};

const expectedDetailResult = {
  success: true,
  message: '',
  body: {
    caseDetails: {
      caseId: caseId1,
      caseTitle: 'Crawford, Turner and Garrett',
      dateFiled: '05-20-2011',
      dateClosed: '06-21-2011',
      assignments: [],
    },
  },
};

jest.mock('../../use-cases/case-management', () => {
  return {
    CaseManagement: jest.fn().mockImplementation(() => {
      return {
        getCaseDetail: () => {
          return Promise.resolve(expectedDetailResult);
        },
        getCases: () => {
          return Promise.resolve(expectedListResult);
        },
      };
    }),
  };
});

describe('cases controller test', () => {
  test('Should get case details of case using caseId', async () => {
    const controller = new CasesController(context);

    const actual1 = await controller.getCaseDetails({ caseId: caseId1 });
    expect(actual1).toEqual(expectedDetailResult);
  });

  test('Should return all case data when getCases called ', async () => {
    const controller = new CasesController(context);

    const actual = await controller.getCases();
    expect(actual).toEqual(expectedListResult);
  });
});
