import { AbstractDbClient } from '../mssql';
import { AcmsGatewayImpl } from './acms.gateway';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { Predicate, PredicateAndPage } from '../../../use-cases/acms-orders/acms-orders';

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

  test('should return a page of consolidation lead case numbers', async () => {
    const databaseResult = [
      { leadCaseId: '11-00000' },
      { leadCaseId: '11-11111' },
      { leadCaseId: '11-22222' },
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
      pageNumber: 1,
    };

    const context = await createMockApplicationContext();
    const gateway = new AcmsGatewayImpl(context);
    const result = await gateway.getLeadCaseIds(context, predicate);

    expect(spy);
    expect(result).toEqual(expectedResult);
  });
});
