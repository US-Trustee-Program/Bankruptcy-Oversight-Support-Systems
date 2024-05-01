import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import { applicationContextCreator } from '../../adapters/utils/application-context-creator';
import { CaseManagement } from '../../use-cases/case-management';
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
      MockData.getCaseDetail({ override: { caseId: caseId1 } }),
      MockData.getCaseDetail({ override: { caseId: caseId2 } }),
    ],
  },
};

const expectedDetailResult = {
  success: true,
  message: '',
  body: {
    caseDetails: MockData.getCaseDetail({ override: { caseId: caseId1 } }),
  },
};

describe('cases controller test', () => {
  let applicationContext: ApplicationContext;
  let controller: CasesController;

  beforeAll(async () => {
    jest.spyOn(CaseManagement.prototype, 'getCaseDetail').mockResolvedValue(expectedDetailResult);
    jest.spyOn(CaseManagement.prototype, 'getCases').mockResolvedValue(expectedListResult);

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
        body: [],
      };
      jest.spyOn(CaseManagement.prototype, 'getCasesByCaseNumber').mockResolvedValue(expected);

      const actual = await controller.searchCases({ caseNumber: '00-00000' });
      expect(actual).toEqual(expected);
    });

    test('should return search results for a caseNumber', async () => {
      const caseNumber = '00-00000';
      const expected = {
        success: true,
        message: '',
        count: 0,
        body: [MockData.getCaseSummary({ override: { caseId: '999-' + caseNumber } })],
      };

      jest.spyOn(CaseManagement.prototype, 'getCasesByCaseNumber').mockResolvedValue(expected);

      const actual = await controller.searchCases({ caseNumber });
      expect(actual).toEqual(expected);
    });

    test('should return an error if an error is encountered', async () => {
      const caseNumber = '00-00000';
      jest
        .spyOn(CaseManagement.prototype, 'getCasesByCaseNumber')
        .mockRejectedValue(new Error('some error'));

      await expect(controller.searchCases({ caseNumber })).rejects.toThrow('some error');
    });
  });
});
