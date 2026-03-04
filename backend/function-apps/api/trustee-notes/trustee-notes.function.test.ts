import { vi } from 'vitest';
import handler from './trustee-notes.function';
import { TrusteeNotesController } from '../../../lib/controllers/trustee-notes/trustee-notes.controller';
import ContextCreator from '../../azure/application-context-creator';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsHttpRequest } from '../../../lib/adapters/types/http';
import { InvocationContext } from '@azure/functions';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { UnknownError } from '../../../lib/common-errors/unknown-error';
import { TrusteeNote } from '@common/cams/trustee-notes';
import { randomUUID } from 'crypto';

const trusteeId = randomUUID();

const defaultRequestProps: Partial<CamsHttpRequest> = {
  method: 'POST',
  body: {
    trusteeId,
    title: 'Sample Note Title',
    content: 'Sample note text',
  },
};

describe('Trustee Notes Function Tests', () => {
  let context;

  beforeEach(() => {
    vi.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(
      MockData.getTrusteeAdminSession(),
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
      meta: { self: req.url },
      data: undefined,
    });
    vi.spyOn(TrusteeNotesController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);

    const response = await handler(req, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('should handle error', async () => {
    const req = createMockAzureFunctionRequest();
    const error = new Error('Some unknown error');
    const { azureHttpResponse } = buildTestResponseError(error);
    vi.spyOn(TrusteeNotesController.prototype, 'handleRequest').mockRejectedValue(error);
    const response = await handler(req, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('should return an HTTP Error if the controller throws during note creation', async () => {
    const error = new UnknownError('MOCK_TRUSTEE_NOTE_MODULE');
    const { azureHttpResponse } = buildTestResponseError(error);
    vi.spyOn(TrusteeNotesController.prototype, 'handleRequest').mockRejectedValue(error);

    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      body: { trusteeId },
    });

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });

  test('should return a list of notes when valid trusteeId is supplied for GET request', async () => {
    const requestOverride: Partial<CamsHttpRequest> = {
      method: 'GET',
      params: { trusteeId },
      body: undefined,
    };

    const request = createMockAzureFunctionRequest({
      ...defaultRequestProps,
      ...requestOverride,
    });

    const expectedNoteList = MockData.buildArray(MockData.getTrusteeNote, 3);
    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess<TrusteeNote[]>({
      meta: { self: request.url },
      data: expectedNoteList,
    });
    vi.spyOn(TrusteeNotesController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);
    expect(response).toEqual(azureHttpResponse);
  });
});
