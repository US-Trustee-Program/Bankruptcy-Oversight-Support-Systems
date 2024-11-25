import { InvocationContext } from '@azure/functions';
import AcmsOrdersController from '../../lib/controllers/acms-orders/acms-orders.controller';
import module from './migrateConsolidation';
import { createMockAzureFunctionContext } from '../../azure/testing-helpers';
import { CamsError } from '../../lib/common-errors/cams-error';

describe('getConsolidations test', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should call getLeadCaseIds controller method', async () => {
    const caseId = '000-11-22222';
    const expected = {
      leadCaseId: caseId,
      success: true,
    };
    const getLeadCaseIdsSpy = jest
      .spyOn(AcmsOrdersController.prototype, 'migrateConsolidation')
      .mockResolvedValue(expected);

    const context = createMockAzureFunctionContext();

    const actual = await module.handler(caseId, context);
    expect(getLeadCaseIdsSpy).toHaveBeenCalledWith(expect.anything(), caseId);
    expect(actual).toEqual(expected);
  });

  test('should properly handle error when getLeadCaseIds controller throws an error', async () => {
    const error = new CamsError('TEST_MODULE', { message: 'getConsolidation Error' });
    jest.spyOn(AcmsOrdersController.prototype, 'migrateConsolidation').mockRejectedValue(error);

    const context: InvocationContext = {} as InvocationContext;

    await expect(module.handler('000-11-22222', context)).rejects.toThrow(error);
  });
});
