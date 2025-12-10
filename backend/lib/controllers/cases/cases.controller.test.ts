import { vi } from 'vitest';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit } from '../../adapters/utils/http-response';
import CaseManagement from '../../use-cases/cases/case-management';
import { CasesController } from './cases.controller';
import { CaseDetail, SyncedCase } from '../../../../common/src/cams/cases';
import {
  mockCamsHttpRequest,
  mockRequestUrl,
} from '../../testing/mock-data/cams-http-request-helper';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ResourceActions } from '../../../../common/src/cams/actions';
import { UnknownError } from '../../common-errors/unknown-error';

describe('cases controller test', () => {
  const caseId1 = '081-11-06541';
  const caseDetail: ResourceActions<CaseDetail> = MockData.getCaseDetail({
    override: { caseId: caseId1 },
  });
  let context: ApplicationContext;
  let controller: CasesController;

  beforeEach(async () => {
    vi.spyOn(CaseManagement.prototype, 'getCaseDetail').mockResolvedValue(caseDetail);

    context = await createMockApplicationContext();
    controller = new CasesController(context);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCaseDetails', () => {
    test('Should get case details of case using caseId', async () => {
      context.request.method = 'GET';
      context.request.params = {
        caseId: caseId1,
      };
      const expected = {
        body: { data: caseDetail },
        headers: expect.anything(),
        statusCode: 200,
      };
      const actual1 = await controller.handleRequest(context);
      expect(actual1).toEqual(expected);
    });

    test('should throw CamsError when use case errors on getCaseDetail', async () => {
      vi.spyOn(CaseManagement.prototype, 'getCaseDetail').mockRejectedValue(
        new Error('some error'),
      );
      await expect(controller.handleRequest(context)).rejects.toThrow(UnknownError);
    });
  });

  describe('searchAllCases', () => {
    const limit = 50;
    const offset = 0;

    test('should return an empty array for no matches', async () => {
      const expected: CamsHttpResponseInit<ResourceActions<SyncedCase>[]> = expect.objectContaining(
        {
          body: {
            meta: { self: mockRequestUrl },
            pagination: {
              limit,
              count: 0,
              currentPage: 0,
              totalCount: 0,
              totalPages: 0,
            },
            data: [],
          },
          headers: expect.anything(),
          statusCode: 200,
        },
      );

      vi.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue({
        metadata: { total: 0 },
        data: [],
      });

      context.request = mockCamsHttpRequest({
        method: 'POST',
        body: { caseNumber: '00-00000', limit, offset },
      });

      const actual = await controller.handleRequest(context);
      expect(actual).toEqual(expected);
    });

    test('should return a next link when total is larger than limit', async () => {
      const caseNumber = '00-00000';
      const data = MockData.buildArray(MockData.getSyncedCase, limit);

      const expected: CamsHttpResponseInit<ResourceActions<SyncedCase>[]> = expect.objectContaining(
        {
          body: {
            meta: { self: mockRequestUrl },
            pagination: expect.objectContaining({
              next: `${mockRequestUrl}?limit=${limit}&offset=${offset + limit}`,
              totalCount: data.length + 1,
              totalPages: data.length / limit + 1,
            }),
            data: expect.anything(),
          },
          headers: expect.anything(),
          statusCode: 200,
        },
      );

      vi.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue({
        metadata: { total: data.length + 1 },
        data,
      });

      context.request = mockCamsHttpRequest({
        method: 'POST',
        body: { caseNumber, limit, offset },
      });

      const actual = await controller.handleRequest(context);
      expect(actual).toEqual(expected);
    });

    test('should not return a next link when result set matches limit', async () => {
      const caseNumber = '00-00000';
      const data = MockData.buildArray(MockData.getSyncedCase, limit);

      const expected: CamsHttpResponseInit<ResourceActions<SyncedCase>[]> = expect.objectContaining(
        {
          body: {
            meta: { self: mockRequestUrl },
            pagination: {
              limit,
              count: data.length,
              currentPage: 1,
              totalCount: data.length,
              totalPages: 1,
            },
            data,
          },
          headers: expect.anything(),
          statusCode: 200,
        },
      );

      vi.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue({
        metadata: { total: data.length },
        data,
      });

      context.request = mockCamsHttpRequest({
        method: 'POST',
        body: { caseNumber, limit, offset },
      });

      const actual = await controller.handleRequest(context);
      expect(actual).toEqual(expected);
      expect(actual.body.data).toHaveLength(limit);
      expect(actual.body.data).toEqual(data.slice(0, limit));
    });

    test('should not return a next link when result set is smaller than limit', async () => {
      const caseNumber = '00-00000';
      const data = MockData.buildArray(MockData.getSyncedCase, limit - 1);
      const currentPage = 1;
      const totalCount = limit * currentPage - 1;
      const totalPages = currentPage;

      const expected: CamsHttpResponseInit<ResourceActions<SyncedCase>[]> = expect.objectContaining(
        {
          body: {
            meta: { self: mockRequestUrl },
            pagination: {
              limit,
              count: data.length,
              currentPage,
              totalCount,
              totalPages,
            },
            data,
          },
          headers: expect.anything(),
          statusCode: 200,
        },
      );

      vi.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue({
        metadata: { total: totalCount },
        data,
      });

      context.request = mockCamsHttpRequest({
        method: 'POST',
        body: { caseNumber, limit, offset },
      });

      const actual = await controller.handleRequest(context);
      expect(actual).toEqual(expected);
      expect(actual.body.data).toHaveLength(limit - 1);
      expect(actual.body.data).toEqual(data);
    });

    test('should return previous link but no next link when on the last set', async () => {
      const caseNumber = '00-00000';
      const limit = 25;
      const previousOffset = '0';
      const data = MockData.buildArray(MockData.getSyncedCase, limit - 1);
      const currentPage = 2;
      const totalCount = limit * currentPage - 1;
      const totalPages = currentPage;

      const expected: CamsHttpResponseInit<ResourceActions<SyncedCase>[]> = expect.objectContaining(
        {
          body: {
            meta: { self: mockRequestUrl },
            pagination: {
              limit,
              count: data.length,
              previous: `${mockRequestUrl}?limit=${limit}&offset=${previousOffset}`,
              currentPage: 2,
              totalCount,
              totalPages,
            },
            data,
          },
          headers: expect.anything(),
          statusCode: 200,
        },
      );

      vi.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue({
        metadata: { total: totalCount },
        data,
      });

      context.request = mockCamsHttpRequest({
        method: 'POST',
        body: { caseNumber, limit, offset: 25 },
      });

      const actual = await controller.handleRequest(context);
      expect(actual).toEqual(expected);
    });

    test('should return next and previous links', async () => {
      const caseNumber = '00-00000';
      const nextOffset = '100';
      const previousOffset = '0';
      const data = MockData.buildArray(MockData.getSyncedCase, limit);
      const currentPage = 2;
      const totalCount = limit * currentPage + 1;
      const totalPages = currentPage + 1;

      const expected: CamsHttpResponseInit<ResourceActions<SyncedCase>[]> = expect.objectContaining(
        {
          body: {
            meta: { self: mockRequestUrl },
            pagination: {
              limit,
              count: limit,
              next: `${mockRequestUrl}?limit=${limit}&offset=${nextOffset}`,
              previous: `${mockRequestUrl}?limit=${limit}&offset=${previousOffset}`,
              currentPage,
              totalCount,
              totalPages,
            },
            data,
          },
          headers: expect.anything(),
          statusCode: 200,
        },
      );

      vi.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue({
        metadata: { total: totalCount },
        data,
      });

      context.request = mockCamsHttpRequest({
        method: 'POST',
        body: { caseNumber, limit: limit, offset: 50 },
      });

      const actual = await controller.handleRequest(context);
      expect(actual).toEqual(expected);
    });

    test('should return search results for a caseNumber', async () => {
      const caseNumber = '00-00000';
      const data = [MockData.getSyncedCase({ override: { caseId: '999-' + caseNumber } })];
      const currentPage = 1;
      const totalCount = 1;
      const totalPages = currentPage;
      const expected: CamsHttpResponseInit<ResourceActions<SyncedCase>[]> = expect.objectContaining(
        {
          body: {
            meta: { self: mockRequestUrl },
            pagination: {
              limit,
              count: data.length,
              currentPage: 1,
              totalCount,
              totalPages,
            },
            data,
          },
          headers: expect.anything(),
          statusCode: 200,
        },
      );

      vi.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue({
        metadata: { total: totalCount },
        data,
      });

      context.request = mockCamsHttpRequest({
        method: 'POST',
        body: { caseNumber, limit, offset },
      });

      const actual = await controller.handleRequest(context);
      expect(actual).toEqual(expected);
    });

    test('should return search results for a divisionCode', async () => {
      const caseNumber = '00-00000';
      const data = [MockData.getSyncedCase({ override: { caseId: '999-' + caseNumber } })];
      const currentPage = 1;
      const totalCount = 1;
      const totalPages = currentPage;

      const expected: CamsHttpResponseInit<ResourceActions<SyncedCase>[]> = expect.objectContaining(
        {
          body: {
            meta: { self: mockRequestUrl },
            pagination: {
              limit,
              count: data.length,
              currentPage: 1,
              totalCount,
              totalPages,
            },
            data,
          },
          headers: expect.anything(),
          statusCode: 200,
        },
      );

      vi.spyOn(CaseManagement.prototype, 'searchCases').mockResolvedValue({
        metadata: { total: totalCount },
        data,
      });

      context.request = mockCamsHttpRequest({
        method: 'POST',
        body: { divisionCodes: ['081'], limit, offset },
      });

      const actual = await controller.handleRequest(context);
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
        const data = [MockData.getSyncedCase()];

        const divisionCodeOne = 'hello';
        const divisionCodeTwo = 'world';

        const expected = {
          divisionCodes: [divisionCodeOne, divisionCodeTwo],
          limit: 25,
          offset: 0,
        };

        const useCaseSpy = vi
          .spyOn(CaseManagement.prototype, 'searchCases')
          .mockResolvedValue({ metadata: { total: 0 }, data });

        context.request = mockCamsHttpRequest({
          method: 'POST',
          body: expected,
          query: args.options,
        });
        await controller.handleRequest(context);
        expect(useCaseSpy).toHaveBeenCalledWith(expect.anything(), expected, args.result);
      },
    );

    test('should return an error if an error is encountered', async () => {
      const caseNumber = '00-00000';
      const error = new Error('some error');

      vi.spyOn(CaseManagement.prototype, 'searchCases').mockRejectedValue(error);

      context.request = mockCamsHttpRequest({ query: { caseNumber } });
      await expect(controller.handleRequest(context)).rejects.toThrow(UnknownError);
    });
  });
});
