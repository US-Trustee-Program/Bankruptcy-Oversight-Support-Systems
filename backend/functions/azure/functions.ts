import { HttpRequest } from '@azure/functions';
import { CamsHttpRequest } from '../lib/adapters/types/http';

export function httpRequestToCamsHttpRequest(request?: HttpRequest): CamsHttpRequest {
  if (!request) throw new Error('Cannot map undefined request object.');
  return {
    method: request.method,
    url: request.url,
    headers: request.headers,
    query: request.query,
    params: request.params,
    body: request.body,
  };
}
