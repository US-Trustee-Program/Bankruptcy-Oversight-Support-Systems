import { describe } from 'vitest';
import { mockLocalStorage } from '../testing/mock-local-storage';

describe('Api2 cache enabled', () => {
  beforeAll(() => {
    vi.stubEnv('CAMS_DISABLE_LOCAL_CACHE', 'false');
    vi.stubEnv('CAMS_PA11Y', 'false');
    vi.stubGlobal('localStorage', mockLocalStorage);
  });

  test('should cache if cache is enabled', async () => {
    const cacheModule = await import('../utils/local-cache');
    const apiModule = await import('./api');
    const api2Module = await import('./api2');

    const isEnabledSpy = vi.spyOn(cacheModule.LocalCache, 'isCacheEnabled').mockReturnValue(true);
    const cacheGetSpy = vi
      .spyOn(cacheModule.LocalCache, 'get')
      .mockReturnValueOnce(null)
      .mockReturnValue({ data: [] });
    const cacheSetSpy = vi.spyOn(cacheModule.LocalCache, 'set').mockResolvedValue(true);
    const fetchSpy = vi.spyOn(apiModule.default, 'get').mockResolvedValue({ data: [] });

    await api2Module.Api2.getOffices();

    expect(isEnabledSpy).toHaveBeenCalledTimes(1);
    expect(cacheGetSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(cacheSetSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockReset();
    cacheSetSpy.mockReset();

    await api2Module.Api2.getOffices();

    expect(isEnabledSpy).toHaveBeenCalledTimes(2);
    expect(cacheGetSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledTimes(0);
    expect(cacheSetSpy).toHaveBeenCalledTimes(0);
  });
});

describe('Api2 cache disabled', () => {
  beforeAll(() => {
    vi.stubEnv('CAMS_DISABLE_LOCAL_CACHE', 'true');
    vi.stubEnv('CAMS_PA11Y', 'false');
    vi.stubGlobal('localStorage', mockLocalStorage);
  });

  test('should cache if cache is enabled', async () => {
    const cacheModule = await import('../utils/local-cache');
    const apiModule = await import('./api');
    const api2Module = await import('./api2');

    const isEnabledSpy = vi.spyOn(cacheModule.LocalCache, 'isCacheEnabled').mockReturnValue(false);
    const cacheGetSpy = vi.spyOn(cacheModule.LocalCache, 'get').mockReturnValue(null);
    const cacheSetSpy = vi.spyOn(cacheModule.LocalCache, 'set').mockResolvedValue(true);
    const fetchSpy = vi.spyOn(apiModule.default, 'get').mockResolvedValue({ data: [] });

    await api2Module.Api2.getOffices();

    expect(isEnabledSpy).toHaveBeenCalled();
    expect(cacheGetSpy).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(cacheSetSpy).not.toHaveBeenCalled();
  });
});
