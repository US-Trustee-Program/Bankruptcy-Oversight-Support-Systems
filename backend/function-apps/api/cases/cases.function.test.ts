import { InvocationContext } from '@azure/functions';

import { ResourceActions } from '../../../../common/src/cams/actions';
import { CaseDetail } from '../../../../common/src/cams/cases';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { commonHeaders } from '../../../lib/adapters/utils/http-response';
import { CamsError } from '../../../lib/common-errors/cams-error';
import { CasesController } from '../../../lib/controllers/cases/cases.controller';
import ContextCreator from '../../azure/application-context-creator';
import {
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import handler from './cases.function';

describe('Cases function', () => {
  jest
    .spyOn(ContextCreator, 'getApplicationContextSession')
    .mockResolvedValue(MockData.getManhattanTrialAttorneySession());
  const caseDetails = MockData.getCaseDetail();
  const request = createMockAzureFunctionRequest({
    method: 'GET',
    params: {
      caseId: caseDetails.caseId,
    },
  });

  const originalEnv = process.env;

  const context = new InvocationContext({
    invocationId: 'id',
    logHandler: () => {},
  });

  beforeAll(() => {
    process.env = {
      ...process.env,
      FEATURE_FLAG_SDK_KEY: undefined,
    };
  });

  afterAll(() => {
    process.env = originalEnv;
    jest.resetAllMocks();
  });

  test('should return success response', async () => {
    const expects = buildTestResponseSuccess<ResourceActions<CaseDetail>>({
      data: caseDetails,
    });
    const { azureHttpResponse, camsHttpResponse } = expects;
    jest.spyOn(CasesController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);
    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('should return error response', async () => {
    const error = new CamsError('test-module', { message: 'Some CAMS error.' });
    jest.spyOn(CasesController.prototype, 'handleRequest').mockRejectedValue(error);
    const response = await handler(request, context);
    expect(response).toEqual({ headers: commonHeaders, jsonBody: error.message, status: 500 });
  });
});
