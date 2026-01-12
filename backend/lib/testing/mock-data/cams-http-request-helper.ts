import MockData from '@common/cams/test-utilities/mock-data';
import { CamsHttpRequest } from '../../adapters/types/http';

export const mockRequestUrl = 'http://mockhost/api';

export function mockCamsHttpRequest<B = unknown>(
  override: Partial<CamsHttpRequest<B>> = {},
): CamsHttpRequest<B> {
  const defaults: CamsHttpRequest<B> = {
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
