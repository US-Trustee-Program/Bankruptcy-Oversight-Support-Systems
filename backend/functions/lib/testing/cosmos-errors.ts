import { ErrorResponse } from '@azure/cosmos';

export const ID_ALREADY_EXISTS = 'Entity with the specified id already exists in the system.';

export function createPreExistingDocumentError() {
  const error = new ErrorResponse(ID_ALREADY_EXISTS);
  error.body = {
    code: 'TEST',
    message: ID_ALREADY_EXISTS,
  };
  return error;
}
