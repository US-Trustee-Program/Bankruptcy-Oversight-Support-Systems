import { applicationContextCreator } from '../utils/application-context-creator';
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
        dateFiled: '2011-05-20',
      },
      {
        caseId: caseId1,
        caseTitle: 'Ali-Cruz',
        dateFiled: '2014-04-23',
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
      dateFiled: '2011-05-20',
      dateClosed: '2011-06-21',
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
  let applicationContext;

  beforeEach(async () => {
    applicationContext = await applicationContextCreator(context);
  });

  test('Should get case details of case using caseId', async () => {
    const controller = new CasesController(applicationContext);

    const actual1 = await controller.getCaseDetails({ caseId: caseId1 });
    expect(actual1).toEqual(expectedDetailResult);
  });

  test('Should return all case data when getCases called ', async () => {
    const controller = new CasesController(applicationContext);

    const actual = await controller.getCases();
    expect(actual).toEqual(expectedListResult);
  });
});
