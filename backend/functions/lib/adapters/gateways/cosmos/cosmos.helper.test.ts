import { ErrorResponse } from '@azure/cosmos';
import { isCosmosErrorResponse, isPreExistingDocumentError } from './cosmos.helper';
import { createPreExistingDocumentError } from '../../../testing/cosmos-errors';

describe('Cosmos helpers', () => {
  test('isCosmosErrorResponse: true', () => {
    const error = new ErrorResponse('TEST');
    const truth = isCosmosErrorResponse(error);
    expect(truth).toBeTruthy();
  });

  test('isCosmosErrorResponse: false', () => {
    const error = new Error('TEST');
    const truth = isCosmosErrorResponse(error);
    expect(truth).toBeFalsy();
  });

  test('isPreExistingDocumentError: true', () => {
    const error = createPreExistingDocumentError();
    const truth = isPreExistingDocumentError(error);
    expect(truth).toBeTruthy();
  });

  test('isPreExistingDocumentError: false', () => {
    const error = new Error('TEST');
    const truth = isPreExistingDocumentError(error);
    expect(truth).toBeFalsy();
  });
});
