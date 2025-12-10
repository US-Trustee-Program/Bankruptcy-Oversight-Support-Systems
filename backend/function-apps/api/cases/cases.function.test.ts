import { vi } from 'vitest';
import handler from './cases.function';
import {
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { CasesController } from '../../../lib/controllers/cases/cases.controller';
import ContextCreator from '../../azure/application-context-creator';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { InvocationContext } from '@azure/functions';
import { ResourceActions } from '../../../../common/src/cams/actions';
import { CaseDetail } from '../../../../common/src/cams/cases';
import { commonHeaders } from '../../../lib/adapters/utils/http-response';
import { CamsError } from '../../../lib/common-errors/cams-error';

describe('Cases function', () => {
  vi.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(
    MockData.getManhattanTrialAttorneySession(),
  );
  const caseDetails = MockData.getCaseDetail();
  const request = createMockAzureFunctionRequest({
    method: 'GET',
    params: {
      caseId: caseDetails.caseId,
    },
  });

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
    vi.resetAllMocks();
  });

  test('should return success response', async () => {
    const expects = buildTestResponseSuccess<ResourceActions<CaseDetail>>({
      data: caseDetails,
    });
    const { camsHttpResponse, azureHttpResponse } = expects;
    vi.spyOn(CasesController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);
    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('should return error response', async () => {
    const error = new CamsError('test-module', { message: 'Some CAMS error.' });
    vi.spyOn(CasesController.prototype, 'handleRequest').mockRejectedValue(error);
    const response = await handler(request, context);
    expect(response).toEqual({ headers: commonHeaders, status: 500, jsonBody: error.message });
  });
});
