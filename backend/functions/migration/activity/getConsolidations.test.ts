import { InvocationContext } from '@azure/functions';
import AcmsOrdersController from '../../lib/controllers/acms-orders/acms-orders.controller';
import module from './getConsolidations';
import { AcmsPredicateAndPage } from '../../lib/use-cases/acms-orders/acms-orders';
import { createMockAzureFunctionContext } from '../../azure/testing-helpers';
import { CamsError } from '../../lib/common-errors/cams-error';

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
    const input: AcmsPredicateAndPage = {
      divisionCode: '101',
      chapter: '15',
      pageNumber: 1,
    };

    const actual = await module.handler(input, context);
    expect(getLeadCaseIdsSpy).toHaveBeenCalledWith(expect.anything(), input);
    expect(actual).toEqual(expected);
  });

  test('should properly handle error when getLeadCaseIds controller throws an error', async () => {
    const error = new CamsError('TEST_MODULE', { message: 'getConsolidation Error' });
    jest.spyOn(AcmsOrdersController.prototype, 'getLeadCaseIds').mockRejectedValue(error);

    const context: InvocationContext = {} as InvocationContext;
    const input: AcmsPredicateAndPage = {
      divisionCode: '101',
      chapter: '15',
      pageNumber: 1,
    };

    await expect(module.handler(input, context)).rejects.toThrow(error);
  });
});
