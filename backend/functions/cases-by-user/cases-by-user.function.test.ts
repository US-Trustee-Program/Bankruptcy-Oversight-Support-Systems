import { createMockAzureFunctionContext, createMockAzureFunctionRequest } from '../azure/functions';
import clearAllMocks = jest.clearAllMocks;
import httpTrigger from '../cases-by-user/cases-by-user.function';
import { CamsError } from '../lib/common-errors/cams-error';
import { CasesController } from '../lib/controllers/cases/cases.controller';
import { CaseBasics } from '../../../common/src/cams/cases';
import { ResponseBodySuccess } from '../../../common/src/api/response';

describe('CasesByUser function', () => {
  const request = createMockAzureFunctionRequest();
  const context = createMockAzureFunctionContext();

  beforeEach(async () => {
    clearAllMocks();
  });

  test('Should return cases-by-user response.', async () => {
    const expectedResponseBody: ResponseBodySuccess<CaseBasics[]> = {
      meta: { self: '', isPaginated: false },
      isSuccess: true,
      data: [],
    };
    jest
      .spyOn(CasesController.prototype, 'getCasesByUserSessionOffices')
      .mockResolvedValue(expectedResponseBody);

    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expectedResponseBody);
  });

  test('error should be properly handled if httpTrigger throws an error', async () => {
    const error = new CamsError('TEST-MODULE', { message: 'some error' });
    jest.spyOn(CasesController.prototype, 'getCasesByUserSessionOffices').mockRejectedValue(error);
    const expectedErrorResponse = {
      success: false,
      message: error.message,
    };
    await httpTrigger(context, request);
    expect(context.res.body).toEqual(expectedErrorResponse);
  });
});
