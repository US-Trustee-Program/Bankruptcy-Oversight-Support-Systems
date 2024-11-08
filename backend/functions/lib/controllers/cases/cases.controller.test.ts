import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit } from '../../adapters/utils/http-response';
import CaseManagement from '../../use-cases/case-management';
import { CasesController } from './cases.controller';
import { CaseBasics, CaseDetail } from '../../../../../common/src/cams/cases';
import {
  mockCamsHttpRequest,
  mockRequestUrl,
} from '../../testing/mock-data/cams-http-request-helper';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ResourceActions } from '../../../../../common/src/cams/actions';

describe('cases controller test', () => {
  const caseId1 = '081-11-06541';
  const caseDetail: ResourceActions<CaseDetail> = MockData.getCaseDetail({
    override: { caseId: caseId1 },
  });
  let context: ApplicationContext;
  let controller: CasesController;

  beforeEach(async () => {
    jest.spyOn(CaseManagement.prototype, 'getCaseDetail').mockResolvedValue(caseDetail);

    context = await createMockApplicationContext();
    controller = new CasesController(context);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleRequest test', () => {
    test('should call getCaseDetails', () => {
      const spy = jest
        .spyOn(CasesController.prototype, 'getCaseDetails')
        .mockResolvedValue({ data: MockData.getCaseDetail() });
      context.request = {
        method: 'GET',
        url: 'http://localhost:3000',
        headers: {},
        query: {},
        params: { caseId: caseId1 },
      };

      controller.handleRequest(context);
      expect(spy).toHaveBeenCalledWith({ caseId: caseId1 });
    });
  });

  describe('getCaseDetails', () => {
    test('Should get case details of case using caseId', async () => {
      const actual1 = await controller.getCaseDetails({ caseId: caseId1 });
      expect(actual1).toEqual({ data: caseDetail });
    });
  });

  describe('searchAllCases', () => {
    const limit = 50;
    const offset = 0;

    test('should return an empty array for no matches', async () => {
      const expected: CamsHttpResponseInit<ResourceActions<CaseBasics>[]> = expect.objectContaining(
        {
          meta: { self: mockRequestUrl },
          pagination: {
            limit,
            count: 0,
            currentPage: 0,
          },
          data: [],
        },
      );

      jest.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue([]);

      const request = mockCamsHttpRequest({
        method: 'POST',
        body: { caseNumber: '00-00000', limit, offset },
      });

      const actual = await controller.searchCases(request);
      expect(actual).toEqual(expected);
    });

    test('should return a next link when result set is larger than limit', async () => {
      const caseNumber = '00-00000';
      const data = MockData.buildArray(MockData.getCaseBasics, limit + 1);
      const dataMinusHint = [...data];
      dataMinusHint.pop();

      const expected: CamsHttpResponseInit<ResourceActions<CaseBasics>[]> = expect.objectContaining(
        {
          meta: { self: mockRequestUrl },
          pagination: expect.objectContaining({
            next: `${mockRequestUrl}?limit=${limit}&offset=${offset + limit}`,
          }),
          data: expect.anything(),
        },
      );

      jest.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue(data);

      const camsHttpRequest = mockCamsHttpRequest({
        method: 'POST',
        body: { caseNumber, limit, offset },
      });

      const actual = await controller.searchCases(camsHttpRequest);
      expect(actual.data).toHaveLength(limit);
      expect(actual.data).toEqual(data.slice(0, limit));
      expect(actual).toEqual(expected);
    });

    test('should not return a next link when result set matches limit', async () => {
      const caseNumber = '00-00000';
      const data = MockData.buildArray(MockData.getCaseBasics, limit);

      const expected: CamsHttpResponseInit<ResourceActions<CaseBasics>[]> = expect.objectContaining(
        {
          meta: { self: mockRequestUrl },
          pagination: {
            limit,
            count: data.length,
            currentPage: 1,
          },
          data,
        },
      );

      jest.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue(data);

      const camsHttpRequest = mockCamsHttpRequest({
        method: 'POST',
        body: { caseNumber, limit, offset },
      });

      const actual = await controller.searchCases(camsHttpRequest);
      expect(actual).toEqual(expected);
      expect(actual.data).toHaveLength(limit);
      expect(actual.data).toEqual(data.slice(0, limit));
    });

    test('should not return a next link when result set is smaller than limit', async () => {
      const caseNumber = '00-00000';
      const data = MockData.buildArray(MockData.getCaseBasics, limit - 1);

      const expected: CamsHttpResponseInit<ResourceActions<CaseBasics>[]> = expect.objectContaining(
        {
          meta: { self: mockRequestUrl },
          pagination: {
            limit,
            count: data.length,
            currentPage: 1,
          },
          data,
        },
      );

      jest.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue(data);

      const camsHttpRequest = mockCamsHttpRequest({
        method: 'POST',
        body: { caseNumber, limit, offset },
      });

      const actual = await controller.searchCases(camsHttpRequest);
      expect(actual).toEqual(expected);
      expect(actual.data).toHaveLength(limit - 1);
      expect(actual.data).toEqual(data);
    });

    test('should return previous link but no next link when on the last set', async () => {
      const caseNumber = '00-00000';
      const limit = 25;
      const previousOffset = '0';
      const data = MockData.buildArray(MockData.getCaseBasics, limit - 1);

      const expected: CamsHttpResponseInit<ResourceActions<CaseBasics>[]> = expect.objectContaining(
        {
          meta: { self: mockRequestUrl },
          pagination: {
            limit,
            count: data.length,
            previous: `${mockRequestUrl}?limit=${limit}&offset=${previousOffset}`,
            currentPage: 2,
          },
          data,
        },
      );

      jest.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue(data);

      const camsHttpRequest = mockCamsHttpRequest({
        method: 'POST',
        body: { caseNumber, limit, offset: 25 },
      });

      const actual = await controller.searchCases(camsHttpRequest);
      expect(actual).toEqual(expected);
    });

    test('should return next and previous links', async () => {
      const caseNumber = '00-00000';
      const nextOffset = '100';
      const previousOffset = '0';
      const data = MockData.buildArray(MockData.getCaseBasics, limit + 1);
      const dataMinusHint = [...data];
      dataMinusHint.pop();

      const expected: CamsHttpResponseInit<ResourceActions<CaseBasics>[]> = expect.objectContaining(
        {
          meta: { self: mockRequestUrl },
          pagination: {
            limit,
            count: dataMinusHint.length,
            next: `${mockRequestUrl}?limit=${limit}&offset=${nextOffset}`,
            previous: `${mockRequestUrl}?limit=${limit}&offset=${previousOffset}`,
            currentPage: 2,
          },
          data: dataMinusHint,
        },
      );

      jest.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue(data);

      const camsHttpRequest = mockCamsHttpRequest({
        method: 'POST',
        body: { caseNumber, limit: limit, offset: 50 },
      });

      const actual = await controller.searchCases(camsHttpRequest);
      expect(actual).toEqual(expected);
      expect(actual.data).toHaveLength(limit);
      expect(actual.data).toEqual(data.slice(0, limit));
    });

    test('should return search results for a caseNumber', async () => {
      const caseNumber = '00-00000';
      const data = [MockData.getCaseBasics({ override: { caseId: '999-' + caseNumber } })];

      const expected: CamsHttpResponseInit<ResourceActions<CaseBasics>[]> = expect.objectContaining(
        {
          meta: { self: mockRequestUrl },
          pagination: {
            limit,
            count: data.length,
            currentPage: 1,
          },
          data,
        },
      );

      jest.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue(data);

      const camsHttpRequest = mockCamsHttpRequest({
        method: 'POST',
        body: { caseNumber, limit, offset },
      });

      const actual = await controller.searchCases(camsHttpRequest);
      expect(actual).toEqual(expected);
    });

    test('should return search results for a divisionCode', async () => {
      const caseNumber = '00-00000';
      const data = [MockData.getCaseBasics({ override: { caseId: '999-' + caseNumber } })];

      const expected: CamsHttpResponseInit<ResourceActions<CaseBasics>[]> = expect.objectContaining(
        {
          meta: { self: mockRequestUrl },
          pagination: {
            limit,
            count: data.length,
            currentPage: 1,
          },
          data,
        },
      );

      jest.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue(data);

      const camsHttpRequest = mockCamsHttpRequest({
        method: 'POST',
        body: { divisionCodes: ['081'], limit, offset },
      });

      const actual = await controller.searchCases(camsHttpRequest);
      expect(actual).toEqual(expected);
    });

    const optionsCases = [
      {
        caseName: 'SHOULD NOT search for case assignments WITH options',
        options: { includeAssignments: 'false' },
        result: false,
      },
      {
        caseName: 'SHOULD NOT search for case assignments WITHOUT options',
        options: undefined,
        result: false,
      },
      {
        caseName: 'SHOULD search for case assignments',
        options: { includeAssignments: 'true' },
        result: true,
      },
    ];
    test.each(optionsCases)(
      'should properly search for a list of division codes and $caseName',
      async (args) => {
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
          method: 'POST',
          body: expected,
          query: args.options,
        });
        await controller.searchCases(camsHttpRequest);
        expect(useCaseSpy).toHaveBeenCalledWith(expect.anything(), expected, args.result);
      },
    );

    test('should return an error if an error is encountered', async () => {
      const caseNumber = '00-00000';
      const error = new Error('some error');

      jest.spyOn(CaseManagement.prototype, 'searchCases').mockRejectedValue(error);

      const camsHttpRequest = mockCamsHttpRequest({ query: { caseNumber } });
      await expect(controller.searchCases(camsHttpRequest)).rejects.toThrow(error);
    });
  });
});
