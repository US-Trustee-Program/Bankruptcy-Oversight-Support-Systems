import { ApplicationContext } from '../../adapters/types/basic';
import { applicationContextCreator } from '../../adapters/utils/application-context-creator';
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
  let applicationContext: ApplicationContext;
  let controller: CasesController;

  beforeAll(async () => {
    applicationContext = await applicationContextCreator(context);
    controller = new CasesController(applicationContext);
  });

  describe('getCaseDetails', () => {
    test('Should get case details of case using caseId', async () => {
      const actual1 = await controller.getCaseDetails({ caseId: caseId1 });
      expect(actual1).toEqual(expectedDetailResult);
    });
  });

  describe('getCases', () => {
    test('Should return all case data when getCases called ', async () => {
      const actual = await controller.getCases();
      expect(actual).toEqual(expectedListResult);
    });
  });

  describe('searchCases', () => {
    test('should return an empty array for no matches', async () => {
      const expected = {
        success: true,
        message: '',
        count: 0,
        body: {
          caseList: [],
        },
      };
      const actual = await controller.searchCases({ caseNumber: '12-12345' });
      expect(actual).toEqual(expected);
    });

    test.skip('should return search results for a caseNumber', async () => {});
    test.skip('should return an error if an error is encountered', async () => {});
  });
});
