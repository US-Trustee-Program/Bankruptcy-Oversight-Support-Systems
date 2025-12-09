import { describe } from 'vitest';
import { mockLocalStorage } from '../testing/mock-local-storage';
import { mockConfiguration } from '@/lib/testing/mock-configuration';

describe('Api2 cache enabled', () => {
  beforeAll(() => {
    vi.stubGlobal('localStorage', mockLocalStorage);
  });

  test('should cache if cache is enabled', async () => {
    mockConfiguration({ disableLocalCache: false });
    const cacheModule = await import('../utils/local-cache');
    const apiModule = await import('./api');
    const api2Module = await import('./api2');

    const isEnabledSpy = vi.spyOn(cacheModule.default, 'isCacheEnabled').mockReturnValue(true);
    const cacheGetSpy = vi
      .spyOn(cacheModule.default, 'get')
      .mockReturnValueOnce(null)
      .mockReturnValue({ expiresAfter: 1, value: { data: [] } });
    const cacheSetSpy = vi.spyOn(cacheModule.default, 'set').mockResolvedValue(true);
    const fetchSpy = vi.spyOn(apiModule.default, 'get').mockResolvedValue({ data: [] });

    await api2Module.default.getOffices();

    expect(isEnabledSpy).toHaveBeenCalledTimes(1);
    expect(cacheGetSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(cacheSetSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockReset();
    cacheSetSpy.mockReset();

    await api2Module.default.getOffices();

    expect(isEnabledSpy).toHaveBeenCalledTimes(2);
    expect(cacheGetSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledTimes(0);
    expect(cacheSetSpy).toHaveBeenCalledTimes(0);
  });
});

describe('Api2 cache disabled', () => {
  beforeAll(() => {
    vi.stubGlobal('localStorage', mockLocalStorage);
  });

  test('should cache if cache is enabled', async () => {
    mockConfiguration({ disableLocalCache: true });
    const cacheModule = await import('../utils/local-cache');
    const apiModule = await import('./api');
    const api2Module = await import('./api2');

    const isEnabledSpy = vi.spyOn(cacheModule.default, 'isCacheEnabled').mockReturnValue(false);
    const cacheGetSpy = vi.spyOn(cacheModule.default, 'get').mockReturnValue(null);
    const cacheSetSpy = vi.spyOn(cacheModule.default, 'set').mockResolvedValue(true);
    const fetchSpy = vi.spyOn(apiModule.default, 'get').mockResolvedValue({ data: [] });

    await api2Module.default.getOffices();

    expect(isEnabledSpy).toHaveBeenCalled();
    expect(cacheGetSpy).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(cacheSetSpy).not.toHaveBeenCalled();
  });
});
