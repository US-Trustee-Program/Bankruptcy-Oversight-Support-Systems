import { AbstractMssqlClient } from '../abstract-mssql-client';
import { AcmsGatewayImpl } from './acms.gateway';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import {
  AcmsConsolidation,
  AcmsConsolidationChildCase,
  Predicate,
  PredicateAndPage,
} from '../../../use-cases/acms-orders/acms-orders';
import { UnknownError } from '../../../common-errors/unknown-error';

const PAGE_SIZE = 50;

describe('ACMS gateway tests', () => {
  const pageCountCases = [
    { leadCaseCount: 245, pageCount: 5 },
    { leadCaseCount: 250, pageCount: 5 },
    { leadCaseCount: 251, pageCount: 6 },
    { pageCount: 0 },
  ];
  test.each(pageCountCases)(
    'should execute query and calculate page count for $leadCaseCount consolidations',
    async (params: { leadCaseCount: number; pageCount: number }) => {
      const spy = jest.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: [{ leadCaseCount: params.leadCaseCount }],
        message: '',
      });
      const predicate: Predicate = {
        chapter: '15',
        divisionCode: '081',
      };
      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getPageCount(context, predicate);
      expect(spy).toHaveBeenCalledWith(
        context,
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({ name: 'chapter', value: predicate.chapter }),
          expect.objectContaining({ name: 'divisionCode', value: predicate.divisionCode }),
        ]),
      );
      expect(result).toEqual(params.pageCount);
    },
  );

  const pageNumber = [1, 3, 5];
  test.each(pageNumber)(
    'should return page number %s of consolidation lead case numbers',
    async (pageNumber) => {
      const databaseResult = [
        { leadCaseId: '811100000' },
        { leadCaseId: '1231111111' },
        { leadCaseId: '711122222' },
      ];
      const expectedResult = databaseResult.map((record) => record.leadCaseId);

      const spy = jest.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
        success: true,
        results: databaseResult,
        message: '',
      });

      const predicate: PredicateAndPage = {
        chapter: '15',
        divisionCode: '081',
        pageNumber,
      };

      const context = await createMockApplicationContext();
      const gateway = new AcmsGatewayImpl(context);
      const result = await gateway.getLeadCaseIds(context, predicate);

      expect(spy).toHaveBeenCalledWith(
        context,
        expect.any(String),
        expect.arrayContaining([
          expect.objectContaining({ name: 'chapter', value: predicate.chapter }),
          expect.objectContaining({ name: 'divisionCode', value: predicate.divisionCode }),
          expect.objectContaining({ name: 'offset', value: PAGE_SIZE * (pageNumber - 1) }),
          expect.objectContaining({ name: 'limit', value: PAGE_SIZE }),
        ]),
      );
      expect(result).toEqual(expectedResult);
    },
  );

  test('should get substantive consolidation details from ACMS', async () => {
    const leadCaseId = '0000000000';
    const databaseResult: AcmsConsolidationChildCase[] = [
      {
        caseId: '000-00-11111',
        consolidationDate: '20240201',
        consolidationType: 'S',
      },
      {
        caseId: '000-00-22222',
        consolidationDate: '20240201',
        consolidationType: 'S',
      },
    ];
    const expectedResult: AcmsConsolidation = {
      leadCaseId: '000-00-00000',
      childCases: [
        {
          caseId: '000-00-11111',
          consolidationDate: '2024-02-01',
          consolidationType: 'substantive',
        },
        {
          caseId: '000-00-22222',
          consolidationDate: '2024-02-01',
          consolidationType: 'substantive',
        },
      ],
    };

    const spy = jest.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
      success: true,
      results: databaseResult,
      message: '',
    });

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    const result = await gateway.getConsolidationDetails(context, leadCaseId);

    expect(spy).toHaveBeenCalledWith(
      context,
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ name: 'leadCaseId', value: leadCaseId })]),
    );
    expect(result).toEqual(expectedResult);
  });

  test('should handle exceptions from executeQuery when calling getPageCount', async () => {
    const mockError = new Error('test error');
    jest.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockRejectedValue(mockError);

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    await expect(async () => {
      return await gateway.getPageCount(context, {
        chapter: '11',
        divisionCode: '010',
      } as Predicate);
    }).rejects.toThrow(
      new UnknownError('ACMS_GATEWAY', {
        status: 500,
        message: 'Unknown Error',
        originalError: mockError,
      }),
    );
  });

  test('should get administrative consolidation details from ACMS', async () => {
    const leadCaseId = '0000000000';
    const databaseResult: AcmsConsolidationChildCase[] = [
      {
        caseId: '000-00-11111',
        consolidationDate: '20240201',
        consolidationType: 'A',
      },
      {
        caseId: '000-00-22222',
        consolidationDate: '20240201',
        consolidationType: 'A',
      },
    ];
    const expectedResult: AcmsConsolidation = {
      leadCaseId: '000-00-00000',
      childCases: [
        {
          caseId: '000-00-11111',
          consolidationDate: '2024-02-01',
          consolidationType: 'administrative',
        },
        {
          caseId: '000-00-22222',
          consolidationDate: '2024-02-01',
          consolidationType: 'administrative',
        },
      ],
    };

    const spy = jest.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockResolvedValue({
      success: true,
      results: databaseResult,
      message: '',
    });

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    const result = await gateway.getConsolidationDetails(context, leadCaseId);

    expect(spy).toHaveBeenCalledWith(
      context,
      expect.any(String),
      expect.arrayContaining([expect.objectContaining({ name: 'leadCaseId', value: leadCaseId })]),
    );
    expect(result).toEqual(expectedResult);
  });

  test('should handle exceptions from executeQuery when calling getLeadCaseIds', async () => {
    const mockError = new Error('test error');
    jest.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockRejectedValue(mockError);

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    await expect(async () => {
      return await gateway.getLeadCaseIds(context, {
        chapter: '11',
        divisionCode: '010',
        pageNumber: 1,
      } as PredicateAndPage);
    }).rejects.toThrow(
      new UnknownError('ACMS_GATEWAY', {
        status: 500,
        message: 'Unknown Error',
        originalError: mockError,
      }),
    );
  });

  test('should handle exceptions from executeQuery when calling getConsolidationDetails', async () => {
    const mockError = new Error('test error');
    jest.spyOn(AbstractMssqlClient.prototype, 'executeQuery').mockRejectedValue(mockError);

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    await expect(async () => {
      return await gateway.getConsolidationDetails(context, '000-00-1234');
    }).rejects.toThrow(
      new UnknownError('ACMS_GATEWAY', {
        status: 500,
        message: 'Unknown Error',
        originalError: mockError,
      }),
    );
  });
});
