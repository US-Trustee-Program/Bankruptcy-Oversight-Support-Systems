import AcmsOrdersController from '../../../../lib/controllers/acms-orders/acms-orders.controller';
import queueMigrateConsolidation from './queueMigrateConsolidation';
import { AcmsPredicate } from '../../../../lib/use-cases/acms-orders/migrate-consolidations';
import { createMockAzureFunctionContext } from '../../../azure/testing-helpers';
import { CamsError } from '../../../../lib/common-errors/cams-error';

describe('getConsolidations test', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should call getLeadCaseIds controller method', async () => {
    const expected = ['000-11-22222', '333-44-55555'];
    const getLeadCaseIdsSpy = jest
      .spyOn(AcmsOrdersController.prototype, 'getLeadCaseIds')
      .mockResolvedValue(expected);

    const context = createMockAzureFunctionContext();
    const input: AcmsPredicate = {
      divisionCode: '101',
      chapter: '15',
    };

    const actual = await queueMigrateConsolidation(input, context);
    expect(getLeadCaseIdsSpy).toHaveBeenCalledWith(expect.anything(), input);
    expect(actual).toEqual(expected);
  });

  test('should properly handle error when getLeadCaseIds controller throws an error', async () => {
    const error = new CamsError('TEST_MODULE', { message: 'getConsolidation Error' });
    jest.spyOn(AcmsOrdersController.prototype, 'getLeadCaseIds').mockRejectedValue(error);

    const context = createMockAzureFunctionContext();
    const input: AcmsPredicate = {
      divisionCode: '101',
      chapter: '15',
    };

    const actual = await queueMigrateConsolidation(input, context);
    expect(actual).toEqual([]);
  });
});
