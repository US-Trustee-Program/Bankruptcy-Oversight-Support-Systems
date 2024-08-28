import { InvocationContext } from '@azure/functions';
import { buildResponseBodySuccess, ResponseBodySuccess } from '../../../common/src/api/response';
import { CaseBasics } from '../../../common/src/cams/cases';
import { MockData } from '../../../common/src/cams/test-utilities/mock-data';
import { createMockAzureFunctionRequest } from '../azure/functions';
import handler from './cases.function';
import ContextCreator from '../azure/application-context-creator';
import { MANHATTAN } from '../../../common/src/cams/test-utilities/offices.mock';
import { CamsRole } from '../../../common/src/cams/roles';

const searchCasesResults = [MockData.getCaseBasics(), MockData.getCaseBasics()];

const caseDetails = MockData.getCaseDetail();
const caseDetailsResponse = {
  body: {
    caseDetails: { ...caseDetails, _actions: [] },
  },
};

jest.mock('../lib/controllers/cases/cases.controller.ts', () => {
  return {
    CasesController: jest.fn().mockImplementation(() => {
      return {
        getCaseDetails: () => {
          return caseDetailsResponse;
        },
        searchCases: (_params: { caseNumber: string }): ResponseBodySuccess<CaseBasics[]> => {
          return buildResponseBodySuccess<CaseBasics[]>(searchCasesResults);
        },
      };
    }),
  };
});

describe('Standard case endpoint tests', () => {
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

  test('Should return 1 case when called with a caseId', async () => {
    const request = createMockAzureFunctionRequest({
      method: 'GET',
      params: {
        caseId: caseDetails.caseId,
      },
    });

    const response = await handler(request, context);
    expect(response.jsonBody).toEqual(caseDetailsResponse.body);
  });

  test('should perform search', async () => {
    const body = {
      caseNumber: '00-12345',
    };
    const request = createMockAzureFunctionRequest({
      method: 'POST',
      body,
    });

    const expectedResponseBody = buildResponseBodySuccess<CaseBasics[]>(searchCasesResults);

    const response = await handler(request, context);

    expect(response.jsonBody).toEqual(expectedResponseBody);
  });
});
