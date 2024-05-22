import { CamsHttpRequest } from '../../adapters/types/http';

export const mockRequestUrl = 'http://mockhost/api';

export function mockCamsHttpRequest(override: Partial<CamsHttpRequest> = {}): CamsHttpRequest {
  const defaults: CamsHttpRequest = {
    query: {},
    method: 'GET',
    url: mockRequestUrl,
    headers: {},
    params: {},
  };
  return {
    ...defaults,
    ...override,
  };
}
