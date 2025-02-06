import AcmsOrdersController from '../../../../lib/controllers/acms-orders/acms-orders.controller';
import migrationConsolidation from './migrateConsolidation';
import { createMockAzureFunctionContext } from '../../../azure/testing-helpers';
import { CamsError } from '../../../../lib/common-errors/cams-error';
import {
  AcmsEtlQueueItem,
  AcmsTransformationResult,
} from '../../../../lib/use-cases/dataflows/migrate-consolidations';

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
    const outputQueueSpy = jest.spyOn(context.extraOutputs, 'set');

    const queueItem: AcmsEtlQueueItem = {
      divisionCode: '000',
      chapter: '15',
      leadCaseId: '000-11-22222',
    };

    await migrationConsolidation(queueItem, context);
    expect(getLeadCaseIdsSpy).toHaveBeenCalledWith(expect.anything(), caseId);
    expect(outputQueueSpy).toHaveBeenCalledWith(expect.anything(), [expected]);
  });

  test('should handle false result', async () => {
    const caseId = '000-11-22222';
    const expected: AcmsTransformationResult = {
      leadCaseId: caseId,
      childCaseCount: 0,
      success: false,
    };
    const getLeadCaseIdsSpy = jest
      .spyOn(AcmsOrdersController.prototype, 'migrateConsolidation')
      .mockResolvedValue(expected);

    const context = createMockAzureFunctionContext();
    const outputQueueSpy = jest.spyOn(context.extraOutputs, 'set');

    const queueItem: AcmsEtlQueueItem = {
      divisionCode: '000',
      chapter: '15',
      leadCaseId: '000-11-22222',
    };

    await migrationConsolidation(queueItem, context);
    expect(getLeadCaseIdsSpy).toHaveBeenCalledWith(expect.anything(), caseId);
    expect(outputQueueSpy).toHaveBeenCalledWith(expect.anything(), [expected]);
  });

  test('should properly handle error when getLeadCaseIds controller throws an error', async () => {
    const error = new CamsError('TEST_MODULE', { message: 'getConsolidation Error' });
    jest.spyOn(AcmsOrdersController.prototype, 'migrateConsolidation').mockRejectedValue(error);

    const context = createMockAzureFunctionContext();
    const outputQueueSpy = jest.spyOn(context.extraOutputs, 'set');

    const queueItem: AcmsEtlQueueItem = {
      divisionCode: '000',
      chapter: '15',
      leadCaseId: '000-11-22222',
    };

    const expected = {
      message: queueItem,
      error,
    };

    await migrationConsolidation(queueItem, context);
    expect(outputQueueSpy).toHaveBeenCalledWith(expect.anything(), [expected]);
  });

  const badQueueItems = [{}, '{}', 0];
  test.each(badQueueItems)(
    'should throw an error if the queue messsage is malformed',
    async (badQueueItem) => {
      const message = 'Invalid ACMS migration ETL queue entry.';
      const context = createMockAzureFunctionContext();
      const outputQueueSpy = jest.spyOn(context.extraOutputs, 'set');

      const expected = {
        message: badQueueItem,
        error: expect.objectContaining({ message }),
      };

      await migrationConsolidation(badQueueItem, context);
      expect(outputQueueSpy).toHaveBeenCalledWith(expect.anything(), [expected]);
    },
  );
});
