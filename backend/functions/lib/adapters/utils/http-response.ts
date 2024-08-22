import { CamsError } from '../../common-errors/cams-error';
import { HttpResponseInit } from '@azure/functions';

const commonHeaders = {
  'Content-Type': 'application/json',
  'Last-Modified': Date.toString(),
};

export function httpSuccess(body: object = {}): HttpResponseInit {
  return {
    headers: commonHeaders,
    status: 200,
    jsonBody: body,
  };
}

export function httpError(error: CamsError): HttpResponseInit {
  return {
    headers: commonHeaders,
    status: error.status,
    body: error.message,
    jsonBody: {
      success: false,
      message: error.message,
    },
  };
}
