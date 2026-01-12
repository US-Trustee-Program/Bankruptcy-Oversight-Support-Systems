import { vi } from 'vitest';
import AcmsOrders, {
  AcmsTransformationResult,
  AcmsPredicate,
} from '../../use-cases/dataflows/migrate-consolidations';
import AcmsOrdersController from './acms-orders.controller';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { NotFoundError } from '../../common-errors/not-found-error';

describe('AcmsOrdersController', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  afterEach(async () => {
    vi.resetAllMocks();
  });

  test('should return array of lead case ids when calling getLeadCaseIds', async () => {
    const leadCaseIds = ['811100000', '1231111111'];
    const predicate: AcmsPredicate = {
      divisionCode: '000',
      chapter: '00',
    };

    vi.spyOn(AcmsOrders.prototype, 'getLeadCaseIds').mockResolvedValue(leadCaseIds);

    const controller = new AcmsOrdersController();
    const actual = await controller.getLeadCaseIds(context, predicate);

    expect(actual).toEqual(leadCaseIds);
  });

  test('should return processing report from migrateConsolidation', async () => {
    const leadCaseId = '811100000';
    const report: AcmsTransformationResult = {
      leadCaseId,
      memberCaseCount: 1,
      success: true,
    };
    const spy = vi.spyOn(AcmsOrders.prototype, 'migrateConsolidation').mockResolvedValue(report);

    const controller = new AcmsOrdersController();
    await controller.migrateConsolidation(context, leadCaseId);

    expect(spy).toHaveBeenCalled();
  });

  test('should handle failed migration', async () => {
    const leadCaseId = '811100000';
    const error = new NotFoundError('TEST_MODULE');

    const spy = vi.spyOn(AcmsOrders.prototype, 'migrateConsolidation').mockRejectedValue(error);

    const controller = new AcmsOrdersController();

    await expect(controller.migrateConsolidation(context, leadCaseId)).rejects.toThrow(error);
    expect(spy).toHaveBeenCalled();
  });

  test('should handle failed listing of lead case IDs', async () => {
    const predicate: AcmsPredicate = {
      divisionCode: '000',
      chapter: '00',
    };

    const error = new Error('some error');
    const spy = vi.spyOn(AcmsOrders.prototype, 'getLeadCaseIds').mockRejectedValue(error);

    const controller = new AcmsOrdersController();

    await expect(controller.getLeadCaseIds(context, predicate)).rejects.toThrow(
      'Failed to find lead case ids.',
    );
    expect(spy).toHaveBeenCalled();
  });
});
