import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import CaseManagement from '../../use-cases/case-management';
import { CasesController } from './cases.controller';
import {
  buildResponseBodySuccess,
  isResponseBodySuccess,
} from '../../../../../common/src/api/response';
import { CaseBasics } from '../../../../../common/src/cams/cases';
import {
  mockCamsHttpRequest,
  mockRequestUrl,
} from '../../testing/mock-data/cams-http-request-helper';
import { createMockApplicationContext } from '../../testing/testing-utilities';

const limit = '25';
const offset = '25';

const caseId1 = '081-11-06541';

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

    applicationContext = await createMockApplicationContext();
    controller = new CasesController(applicationContext);
  });

  describe('getCaseDetails', () => {
    test('Should get case details of case using caseId', async () => {
      const actual1 = await controller.getCaseDetails({ caseId: caseId1 });
      expect(actual1).toEqual(expectedDetailResult);
    });
  });

  describe('searchAllCases', () => {
    test('should return an empty array for no matches', async () => {
      const expected = buildResponseBodySuccess<CaseBasics[]>([], {
        self: mockRequestUrl,
      });

      jest.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue([]);

      const camsHttpRequest = mockCamsHttpRequest({ query: { caseNumber: '00-00000' } });
      const actual = await controller.searchAllCases(camsHttpRequest);
      expect(actual).toEqual(expected);
    });

    test('should return a next link when result set is larger than limit', async () => {
      const caseNumber = '00-00000';
      const data = MockData.buildArray(MockData.getCaseBasics, parseInt(limit) + 1);
      const dataMinusHint = [...data];
      dataMinusHint.pop();
      const expected = buildResponseBodySuccess<CaseBasics[]>(dataMinusHint, {
        self: mockRequestUrl,
        next: `${mockRequestUrl}?limit=${limit}&offset=${offset}`,
      });

      jest.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue(data);

      const camsHttpRequest = mockCamsHttpRequest({ query: { caseNumber } });
      const actual = await controller.searchAllCases(camsHttpRequest);
      expect(actual).toEqual(expected);
      expect(isResponseBodySuccess(actual)).toBeTruthy();
      if (isResponseBodySuccess(actual)) {
        expect(actual.data).toHaveLength(parseInt(limit));
        expect(actual.data).toEqual(data.slice(0, parseInt(limit)));
      }
    });

    test('should not return a next link when result set matches limit', async () => {
      const caseNumber = '00-00000';
      const data = MockData.buildArray(MockData.getCaseBasics, parseInt(limit));
      const expected = buildResponseBodySuccess<CaseBasics[]>(data, {
        self: mockRequestUrl,
      });

      jest.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue(data);

      const camsHttpRequest = mockCamsHttpRequest({ query: { caseNumber } });
      const actual = await controller.searchAllCases(camsHttpRequest);
      expect(actual).toEqual(expected);
      expect(isResponseBodySuccess(actual)).toBeTruthy();
      if (isResponseBodySuccess(actual)) {
        expect(actual.data).toHaveLength(parseInt(limit));
        expect(actual.data).toEqual(data.slice(0, parseInt(limit)));
      }
    });

    test('should not return a next link when result set is smaller than limit', async () => {
      const caseNumber = '00-00000';
      const data = MockData.buildArray(MockData.getCaseBasics, parseInt(limit) - 1);
      const expected = buildResponseBodySuccess<CaseBasics[]>(data, {
        self: mockRequestUrl,
      });

      jest.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue(data);

      const camsHttpRequest = mockCamsHttpRequest({ query: { caseNumber } });
      const actual = await controller.searchAllCases(camsHttpRequest);
      expect(actual).toEqual(expected);
      expect(isResponseBodySuccess(actual)).toBeTruthy();
      if (isResponseBodySuccess(actual)) {
        expect(actual.data).toHaveLength(parseInt(limit) - 1);
        expect(actual.data).toEqual(data);
      }
    });

    test('should return previous link but no next link when on the last set', async () => {
      const caseNumber = '00-00000';
      const limit = '50';
      const offset = '50';
      const previousOffset = '0';
      const data = MockData.buildArray(MockData.getCaseBasics, parseInt(limit) - 1);
      const expected = buildResponseBodySuccess<CaseBasics[]>(data, {
        isPaginated: true,
        count: data.length,
        self: mockRequestUrl,
        previous: `${mockRequestUrl}?limit=${limit}&offset=${previousOffset}`,
        limit: parseInt(limit),
        currentPage: 2,
      });

      jest.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue(data);

      const camsHttpRequest = mockCamsHttpRequest({ query: { caseNumber, limit, offset } });
      const actual = await controller.searchAllCases(camsHttpRequest);
      expect(actual).toEqual(expected);
    });

    test('should return next and previous links', async () => {
      const caseNumber = '00-00000';
      const limit = '50';
      const offset = '50';
      const nextOffset = '100';
      const previousOffset = '0';
      const data = MockData.buildArray(MockData.getCaseBasics, parseInt(limit) + 1);
      const expectedMeta = {
        isPaginated: true,
        count: data.length - 1,
        self: mockRequestUrl,
        next: `${mockRequestUrl}?limit=${limit}&offset=${nextOffset}`,
        previous: `${mockRequestUrl}?limit=${limit}&offset=${previousOffset}`,
        limit: parseInt(limit),
        currentPage: 2,
      };

      jest.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue(data);

      const camsHttpRequest = mockCamsHttpRequest({ query: { caseNumber, limit, offset } });
      const actual = await controller.searchAllCases(camsHttpRequest);
      expect(actual).toEqual(expect.objectContaining({ meta: expectedMeta, isSuccess: true }));
      expect(isResponseBodySuccess(actual)).toBeTruthy();
      if (isResponseBodySuccess(actual)) {
        expect(actual.data).toHaveLength(parseInt(limit));
        expect(actual.data).toEqual(data.slice(0, parseInt(limit)));
      }
    });

    test('should return search results for a caseNumber', async () => {
      const caseNumber = '00-00000';
      const data = [MockData.getCaseBasics({ override: { caseId: '999-' + caseNumber } })];
      const expected = buildResponseBodySuccess<CaseBasics[]>(data, {
        self: mockRequestUrl,
      });

      jest.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue(data);

      const camsHttpRequest = mockCamsHttpRequest({ query: { caseNumber } });
      const actual = await controller.searchAllCases(camsHttpRequest);
      expect(actual).toEqual(expected);
    });

    test('should return search results for a divisionCode', async () => {
      const caseNumber = '00-00000';
      const data = [MockData.getCaseBasics({ override: { caseId: '999-' + caseNumber } })];
      const expected = buildResponseBodySuccess<CaseBasics[]>(data, {
        self: mockRequestUrl,
      });

      jest.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue(data);

      const camsHttpRequest = mockCamsHttpRequest({ query: { divisionCodes: '081' } });
      const actual = await controller.searchAllCases(camsHttpRequest);
      expect(actual).toEqual(expected);
    });

    test('should properly search for a list of division codes', async () => {
      const data = [MockData.getCaseBasics()];

      const divisionCodeOne = 'hello';
      const divisionCodeTwo = 'world';

      const expected = {
        divisionCodes: [divisionCodeOne, divisionCodeTwo],
        limit: 25,
        offset: 0,
      };

      const useCaseSpy = jest
        .spyOn(CaseManagement.prototype, 'searchCases')
        .mockResolvedValue(data);

      const camsHttpRequest = mockCamsHttpRequest({
        query: { divisionCodes: `${divisionCodeOne},${divisionCodeTwo}` },
      });
      await controller.searchAllCases(camsHttpRequest);
      expect(useCaseSpy).toHaveBeenCalledWith(expect.anything(), expected);
    });

    test('should return an error if an error is encountered', async () => {
      const caseNumber = '00-00000';
      const error = new Error('some error');

      jest.spyOn(CaseManagement.prototype, 'searchCases').mockRejectedValue(error);

      const camsHttpRequest = mockCamsHttpRequest({ query: { caseNumber } });
      await expect(controller.searchAllCases(camsHttpRequest)).rejects.toThrow(error);
    });
  });

  describe('getCasesByUserSessionOffices', () => {
    const offices = MockData.buildArray(MockData.randomOffice, 3);
    const divisionCodes = offices.map((office) => office.courtDivisionCode);

    beforeAll(async () => {
      applicationContext.session = MockData.getCamsSession({ user: { name: 'tester', offices } });
    });

    test('should get cases for the users offices', async () => {
      const camsHttpRequest = mockCamsHttpRequest();

      const searchSpy = jest.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue([]);
      await controller.getCasesByUserSessionOffices(camsHttpRequest);

      const expected = {
        divisionCodes,
        limit: 25,
        offset: 0,
      };

      expect(searchSpy).toHaveBeenCalledWith(expect.anything(), expected);
    });

    test('should get cases for the desired chapters', async () => {
      const camsHttpRequest = mockCamsHttpRequest({ query: { chapters: '15,12' } });

      const searchSpy = jest.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue([]);
      await controller.getCasesByUserSessionOffices(camsHttpRequest);

      const expected = {
        divisionCodes,
        chapters: ['15', '12'],
        limit: 25,
        offset: 0,
      };

      expect(searchSpy).toHaveBeenCalledWith(expect.anything(), expected);
    });
  });
});
