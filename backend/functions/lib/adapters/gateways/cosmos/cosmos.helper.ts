import { ErrorResponse } from '@azure/cosmos';

export const ID_ALREADY_EXISTS = 'Entity with the specified id already exists in the system.';

export function isCosmosErrorResponse(e): e is ErrorResponse {
  return e instanceof ErrorResponse;
}

export function isPreExistingDocumentError(e: Error): boolean {
  if (isCosmosErrorResponse(e)) {
    return e.body.message.includes(ID_ALREADY_EXISTS);
  }
  return false;
}
