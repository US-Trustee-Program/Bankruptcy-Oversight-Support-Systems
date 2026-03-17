import getAppConfiguration from './appConfiguration';

describe('appConfiguration', () => {
  const originalConfig = window.CAMS_CONFIGURATION;

  afterEach(() => {
    window.CAMS_CONFIGURATION = originalConfig;
  });

  test('returns undefined inactiveTimeout when CAMS_INACTIVE_TIMEOUT is not set', () => {
    window.CAMS_CONFIGURATION = { ...originalConfig };
    delete (window.CAMS_CONFIGURATION as Record<string, string>).CAMS_INACTIVE_TIMEOUT;

    const config = getAppConfiguration();
    expect(config.inactiveTimeout).toBeUndefined();
  });

  test('parses inactiveTimeout when CAMS_INACTIVE_TIMEOUT is set', () => {
    window.CAMS_CONFIGURATION = {
      ...originalConfig,
      CAMS_INACTIVE_TIMEOUT: '300',
    };

    const config = getAppConfiguration();
    expect(config.inactiveTimeout).toBe(300);
  });

  test('returns useFakeApi true when CAMS_USE_FAKE_API is "true"', () => {
    window.CAMS_CONFIGURATION = { ...originalConfig, CAMS_USE_FAKE_API: 'true' };
    expect(getAppConfiguration().useFakeApi).toBe(true);
  });

  test('returns useFakeApi false when CAMS_USE_FAKE_API is "false"', () => {
    window.CAMS_CONFIGURATION = { ...originalConfig, CAMS_USE_FAKE_API: 'false' };
    expect(getAppConfiguration().useFakeApi).toBe(false);
  });
});
