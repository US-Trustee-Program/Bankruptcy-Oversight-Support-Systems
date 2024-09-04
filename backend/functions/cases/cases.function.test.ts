import handler from './cases.function';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionContext,
  createMockAzureFunctionRequest,
} from '../azure/testing-helpers';
import { CasesController } from '../lib/controllers/cases/cases.controller';
import { NotFoundError } from '../lib/common-errors/not-found-error';
import ContextCreator from '../azure/application-context-creator';
import MockData from '../../../common/src/cams/test-utilities/mock-data';
import { MANHATTAN } from '../../../common/src/cams/test-utilities/offices.mock';
import { CamsRole } from '../../../common/src/cams/roles';
import { InvocationContext } from '@azure/functions';
import { ResourceActions } from '../../../common/src/cams/actions';
import { CaseBasics, CaseDetail } from '../../../common/src/cams/cases';

describe('Cases function', () => {
  jest.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(
    MockData.getCamsSession({
      user: {
        id: 'userId-Bob Jones',
        name: 'Bob Jones',
        offices: [MANHATTAN],
        roles: [CamsRole.TrialAttorney],
      },
    }),
  );

  const originalEnv = process.env;

  const context = new InvocationContext({
    logHandler: () => {},
    invocationId: 'id',
  });

  beforeAll(() => {
    process.env = {
      ...process.env,
      FEATURE_FLAG_SDK_KEY: undefined,
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('Should return a case when called with a caseId', async () => {
    const caseDetails = MockData.getCaseDetail();
    const request = createMockAzureFunctionRequest({
      method: 'GET',
      params: {
        caseId: caseDetails.caseId,
      },
    });

    const expects = buildTestResponseSuccess<ResourceActions<CaseDetail>>({
      data: caseDetails,
    });
    const { camsHttpResponse, azureHttpResponse } = expects;

    jest.spyOn(CasesController.prototype, 'getCaseDetails').mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('should perform search', async () => {
    const request = createMockAzureFunctionRequest({
      method: 'POST',
      body: {
        caseNumber: '00-12345',
      },
    });
    const expects = buildTestResponseSuccess<ResourceActions<CaseBasics>[]>({
      data: [MockData.getCaseBasics(), MockData.getCaseBasics()],
    });
    const { camsHttpResponse, azureHttpResponse } = expects;

    jest.spyOn(CasesController.prototype, 'searchCases').mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });
});

describe('Cases function errors', () => {
  const context = createMockAzureFunctionContext();

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  type TestParams = { name: string; error: Error; requestParam: object };
  const params: TestParams[] = [
    {
      name: 'getCaseDetails',
      error: new NotFoundError('test-error'),
      requestParam: { params: { caseId: '000-00-12345' } },
    },
    {
      name: 'searchCases',
      error: new Error('test-error'),
      requestParam: {
        method: 'POST',
        body: { caseNumber: '00-12345' },
      },
    },
  ];

  test.each(params)(`should handle error from $name`, async (params: TestParams) => {
    const request = createMockAzureFunctionRequest(params.requestParam);
    const { azureHttpResponse } = buildTestResponseError(params.error);

    jest.spyOn(CasesController.prototype, 'getCaseDetails').mockRejectedValue(params.error);
    jest.spyOn(CasesController.prototype, 'searchCases').mockRejectedValue(params.error);

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });
});
