import { ErrorResponse } from '@azure/cosmos';
import { ID_ALREADY_EXISTS } from '../adapters/gateways/cosmos/cosmos.helper';

export function createPreExistingDocumentError() {
  const error = new ErrorResponse(ID_ALREADY_EXISTS);
  error.body = {
    code: 'TEST',
    message: ID_ALREADY_EXISTS,
  };
  return error;
}
