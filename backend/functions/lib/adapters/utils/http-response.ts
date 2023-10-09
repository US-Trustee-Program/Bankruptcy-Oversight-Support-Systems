import { ApiResponse } from '../types/http';
import { CamsError } from '../../common-errors/cams-error';

const commonHeaders = {
  'Content-Type': 'application/json',
  'Last-Modified': Date.toString(),
};

export function httpSuccess(body: object = {}): ApiResponse {
  return {
    headers: commonHeaders,
    statusCode: 200,
    body,
  };
}

export function httpError(error: CamsError): ApiResponse {
  return {
    headers: commonHeaders,
    statusCode: error.status,
    body: {
      error: error.message,
    },
  };
}
