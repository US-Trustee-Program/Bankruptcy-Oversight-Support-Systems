import { InvocationContext } from '@azure/functions';
import { createMockAzureFunctionContext } from '../../azure/testing-helpers';
import { CamsError } from '../../lib/common-errors/cams-error';
import AcmsOrdersController from '../../lib/controllers/acms-orders/acms-orders.controller';
import { PredicateAndPage } from '../../lib/use-cases/acms-orders/acms-orders';
import module from './getPageCount';

describe('getPageCount test', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should call getPageCount controller method', async () => {
    const expected = 3;
    const getPageCountSpy = jest
      .spyOn(AcmsOrdersController.prototype, 'getPageCount')
      .mockResolvedValue(expected);

    const context = createMockAzureFunctionContext();
    const input: PredicateAndPage = {
      divisionCode: '101',
      chapter: '15',
      pageNumber: 1,
    };

    const actual = await module.handler(input, context);
    expect(getPageCountSpy).toHaveBeenCalledWith(expect.anything(), input);
    expect(actual).toEqual(expected);
  });

  test('should properly handle error when getPageCount controller throws an error', async () => {
    const error = new CamsError('TEST_MODULE', { message: 'getPageCount Error' });
    jest.spyOn(AcmsOrdersController.prototype, 'getPageCount').mockRejectedValue(error);

    const context: InvocationContext = {} as InvocationContext;
    const input: PredicateAndPage = {
      divisionCode: '101',
      chapter: '15',
      pageNumber: 1,
    };

    await expect(module.handler(input, context)).rejects.toThrow(error);
  });
});
