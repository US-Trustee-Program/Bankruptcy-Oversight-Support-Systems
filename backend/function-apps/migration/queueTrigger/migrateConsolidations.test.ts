import { InvocationContext } from '@azure/functions';
import AcmsOrdersController from '../../../lib/controllers/acms-orders/acms-orders.controller';
import migrationConsolidation from './migrateConsolidation';
import { createMockAzureFunctionContext } from '../../azure/testing-helpers';
import { CamsError } from '../../../lib/common-errors/cams-error';
import {
  AcmsEtlQueueItem,
  AcmsTransformationResult,
} from '../../../lib/use-cases/acms-orders/acms-orders';

describe('getConsolidations test', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should call getLeadCaseIds controller method', async () => {
    const caseId = '000-11-22222';
    const expected: AcmsTransformationResult = {
      leadCaseId: caseId,
      childCaseCount: 2,
      success: true,
    };
    const getLeadCaseIdsSpy = jest
      .spyOn(AcmsOrdersController.prototype, 'migrateConsolidation')
      .mockResolvedValue(expected);

    const context = createMockAzureFunctionContext();

    const queueItem: AcmsEtlQueueItem = {
      divisionCode: '000',
      chapter: '15',
      leadCaseId: '000-11-22222',
    };

    await migrationConsolidation(queueItem, context);
    expect(getLeadCaseIdsSpy).toHaveBeenCalledWith(expect.anything(), caseId);
  });

  test('should properly handle error when getLeadCaseIds controller throws an error', async () => {
    const error = new CamsError('TEST_MODULE', { message: 'getConsolidation Error' });
    jest.spyOn(AcmsOrdersController.prototype, 'migrateConsolidation').mockRejectedValue(error);

    const context: InvocationContext = {} as InvocationContext;

    const queueItem: AcmsEtlQueueItem = {
      divisionCode: '000',
      chapter: '15',
      leadCaseId: '000-11-22222',
    };

    await expect(migrationConsolidation(queueItem, context)).rejects.toThrow(error);
  });
});
