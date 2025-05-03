import { MockData } from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsHttpRequest } from '../../adapters/types/http';

export const mockRequestUrl = 'http://mockhost/api';

export function mockCamsHttpRequest<B = unknown>(
  override: Partial<CamsHttpRequest<B>> = {},
): CamsHttpRequest<B> {
  const defaults: CamsHttpRequest<B> = {
    headers: {
      authorization: 'Bearer ' + MockData.getJwt(),
    },
    method: 'GET',
    params: {},
    query: {},
    url: mockRequestUrl,
  };
  return {
    ...defaults,
    ...override,
  };
}
