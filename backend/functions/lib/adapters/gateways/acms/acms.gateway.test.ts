import { AbstractDbClient } from '../mssql';
import { AcmsGatewayImpl } from './acms.gateway';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { Predicate } from '../../../use-cases/acms-orders/acms-orders';

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
});
