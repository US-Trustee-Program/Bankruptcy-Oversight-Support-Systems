import { AbstractDbClient } from '../mssql';
import { AcmsGatewayImpl } from './acms.gateway';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import {
  AcmsConsolidation,
  AcmsConsolidationChildCase,
  Predicate,
  PredicateAndPage,
} from '../../../use-cases/acms-orders/acms-orders';

const PAGE_SIZE = 50;

describe('ACMS gateway tests', () => {
  const pageCountCases = [
    { leadCaseCount: 245, pageCount: 5 },
    { leadCaseCount: 250, pageCount: 5 },
    { leadCaseCount: 251, pageCount: 6 },
  ];
  test.each(pageCountCases)(
    'should execute query and calculate page count for $leadCaseCount consolidations',
    async (params: { leadCaseCount: number; pageCount: number }) => {
      const spy = jest.spyOn(AbstractDbClient.prototype, 'executeQuery').mockResolvedValue({
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

      const spy = jest.spyOn(AbstractDbClient.prototype, 'executeQuery').mockResolvedValue({
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

  test('should get consolidation details from ACMS', async () => {
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

    const spy = jest.spyOn(AbstractDbClient.prototype, 'executeQuery').mockResolvedValue({
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
});
