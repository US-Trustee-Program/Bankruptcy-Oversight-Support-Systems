import { vi } from 'vitest';
import Api from '../models/api';
import MockApi from '../models/chapter15-mock.api.cases';
import { setApiContext, useApi } from './UseApi';
import { LocalStorage } from '../utils/local-storage';
import { MockData } from '@common/cams/test-utilities/mock-data';

describe('UseApi Hook', () => {
  const mockSession = MockData.getCamsSession();
  vi.spyOn(LocalStorage, 'getSession').mockReturnValue(mockSession);

  test('should return the concrete API by default', () => {
    vi.stubEnv('CAMS_PA11Y', '');
    vi.resetModules();
    const actualApi = useApi();
    expect(actualApi).toEqual(Api);
  });

  test('should return the mock API by when CAMS_PA11Y env var is true', () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    vi.resetModules();
    const actualApi = useApi();
    expect(actualApi).toEqual(MockApi);
  });

  test('should be able to set the module scoped API', () => {
    setApiContext(MockApi);
    const mock = useApi();
    expect(mock).toEqual(MockApi);

    setApiContext(Api);
    const real = useApi();
    expect(real).toEqual(Api);
  });
});
