import { vi } from 'vitest';
import { CamsSession, MOCK_AUTHORIZATION_BEARER_TOKEN } from '@/login/login-library';
import Api from '../models/api';
import MockApi from '../models/chapter15-mock.api.cases';
import { setApiContext, useApi } from './UseApi';

const mockSession: CamsSession = {
  provider: 'mock',
  user: { name: 'Mock User' },
  apiToken: MOCK_AUTHORIZATION_BEARER_TOKEN,
};

describe('UseApi Hook', () => {
  test('should return the concrete API by default', () => {
    vi.stubEnv('CAMS_PA11Y', '');
    vi.resetModules();
    const actualApi = useApi(mockSession);
    expect(actualApi).toEqual(Api);
  });

  test('should return the mock API by when CAMS_PA11Y env var is true', () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    vi.resetModules();
    const actualApi = useApi(mockSession);
    expect(actualApi).toEqual(MockApi);
  });

  test('should be able to set the module scoped API', () => {
    setApiContext(MockApi);
    const mock = useApi(mockSession);
    expect(mock).toEqual(MockApi);

    setApiContext(Api);
    const real = useApi(mockSession);
    expect(real).toEqual(Api);
  });
});
