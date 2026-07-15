import { vi } from 'vitest';
import handler from './case.notes.function';
import { CaseNotesController } from '../../../lib/controllers/case-notes/case.notes.controller';
import ContextCreator from '../../azure/application-context-creator';
import MockData from '@common/cams/test-utilities/mock-data';
import { InvocationContext } from '@azure/functions';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';

describe('Case Notes Function Tests', () => {
  let context;

  beforeEach(() => {
    vi.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(
      MockData.getManhattanAssignmentManagerSession(),
    );
    context = new InvocationContext({
      logHandler: () => {},
      invocationId: 'id',
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test('should handle successful response', async () => {
    const req = createMockAzureFunctionRequest();
    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess({
      meta: {
        self: req.url,
      },
      data: undefined,
    });
    vi.spyOn(CaseNotesController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);

    const response = await handler(req, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('should handle error', async () => {
    const req = createMockAzureFunctionRequest();
    const error = new Error('Some unknown error');
    const { azureHttpResponse } = buildTestResponseError(error);
    vi.spyOn(CaseNotesController.prototype, 'handleRequest').mockRejectedValue(error);
    const response = await handler(req, context);
    expect(response).toEqual(azureHttpResponse);
  });
});
