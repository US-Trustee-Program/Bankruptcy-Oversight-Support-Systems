import AcmsOrders, {
  AcmsTransformationResult,
  AcmsPredicate,
  AcmsPredicateAndPage,
} from '../../use-cases/acms-orders/acms-orders';
import AcmsOrdersController from './acms-orders.controller';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';

describe('AcmsOrdersController', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  test('should return ACMS Order Consolidations page count', async () => {
    jest.spyOn(AcmsOrders.prototype, 'getPageCount').mockResolvedValue(5);
    const predicate: AcmsPredicate = {
      divisionCode: '000',
      chapter: '00',
    };

    const controller = new AcmsOrdersController();
    const actual = await controller.getPageCount(context, predicate);

    expect(actual).toEqual(5);
  });

  test('should return array of lead case ids when calling getConsolidationOrders', async () => {
    const leadCaseIds = ['811100000', '1231111111'];
    const predicate: AcmsPredicateAndPage = {
      divisionCode: '000',
      chapter: '00',
      pageNumber: 1,
    };

    jest.spyOn(AcmsOrders.prototype, 'getLeadCaseIds').mockResolvedValue(leadCaseIds);

    const controller = new AcmsOrdersController();
    const actual = await controller.getLeadCaseIds(context, predicate);

    expect(actual).toEqual(leadCaseIds);
  });

  test('should return processing report from migrateConsolidation', async () => {
    const leadCaseId = '811100000';
    const report: AcmsTransformationResult = {
      leadCaseId,
      childCaseCount: 1,
      success: true,
    };
    const spy = jest.spyOn(AcmsOrders.prototype, 'migrateConsolidation').mockResolvedValue(report);

    const controller = new AcmsOrdersController();
    await controller.migrateConsolidation(context, leadCaseId);

    expect(spy).toHaveBeenCalled();
  });
});
