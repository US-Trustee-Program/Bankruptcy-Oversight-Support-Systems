import { MOCK_AUTHORIZATION_BEARER_TOKEN } from '../../../../../common/src/cams/session';
import { CamsHttpRequest } from '../../adapters/types/http';

export const mockRequestUrl = 'http://mockhost/api';

export function mockCamsHttpRequest(override: Partial<CamsHttpRequest> = {}): CamsHttpRequest {
  const defaults: CamsHttpRequest = {
    query: {},
    method: 'GET',
    url: mockRequestUrl,
    headers: {
      authorization: 'Bearer ' + MOCK_AUTHORIZATION_BEARER_TOKEN,
    },
    params: {},
  };
  return {
    ...defaults,
    ...override,
  };
}
