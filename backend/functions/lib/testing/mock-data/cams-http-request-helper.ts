import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { CamsHttpRequest } from '../../adapters/types/http';

export const mockRequestUrl = 'http://mockhost/api';

export function mockCamsHttpRequest(override: Partial<CamsHttpRequest> = {}): CamsHttpRequest {
  const defaults: CamsHttpRequest = {
    query: {},
    method: 'GET',
    url: mockRequestUrl,
    headers: {
      authorization: 'Bearer ' + MockData.getJwt(),
    },
    params: {},
  };
  return {
    ...defaults,
    ...override,
  };
}
