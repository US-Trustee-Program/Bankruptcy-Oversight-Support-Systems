import { vi } from 'vitest';

describe('Authorization config tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...process.env,
      CAMS_LOGIN_PROVIDER_CONFIG: undefined,
      CAMS_LOGIN_PROVIDER: '',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test.each(['mock', 'okta', 'none'])(
    'should get %s provider from environment',
    async (expected) => {
      process.env.CAMS_LOGIN_PROVIDER = expected;

      vi.resetModules();
      const configModule = await import('./authorization-configuration');
      const config = configModule.getAuthorizationConfig();
      expect(config.provider).toEqual(expected);
    },
  );

  test('should return null for an invalid provider read from the environment', async () => {
    process.env.CAMS_LOGIN_PROVIDER = 'bogus';

    vi.resetModules();
    const configModule = await import('./authorization-configuration');
    const config = configModule.getAuthorizationConfig();
    expect(config.provider).toBeNull();
  });

  test('should return audience from issuer', async () => {
    process.env.CAMS_LOGIN_PROVIDER_CONFIG = 'issuer=https://valid.okta.com/oauth2/default';

    vi.resetModules();
    const configModule = await import('./authorization-configuration');
    const config = configModule.getAuthorizationConfig();
    expect(config.audience).toEqual('api://default');
  });

  test('should return null audience from issuer if not path is provided', async () => {
    process.env.CAMS_LOGIN_PROVIDER_CONFIG = 'issuer=https://valid.okta.com/';

    vi.resetModules();
    const configModule = await import('./authorization-configuration');
    const config = configModule.getAuthorizationConfig();
    expect(config.audience).toBeNull();
  });

  test('module should not fail to parse and initialize config', async () => {
    vi.resetModules();
    const configModule = await import('./authorization-configuration');
    const config = configModule.getAuthorizationConfig();
    expect(config.audience).toBeNull();
    expect(config.issuer).toBeNull();
    expect(config.provider).toBeNull();
  });

  test('module should not fail to parse and initialize config with nonsense env var', async () => {
    process.env.CAMS_LOGIN_PROVIDER = 'bogus';
    process.env.CAMS_LOGIN_PROVIDER_CONFIG = 'nonsense';

    vi.resetModules();
    const configModule = await import('./authorization-configuration');
    const config = configModule.getAuthorizationConfig();
    expect(config.audience).toBeNull();
    expect(config.issuer).toBeNull();
    expect(config.provider).toBeNull();
  });

  test('should get mock config if provider is "mock"', async () => {
    process.env.CAMS_LOGIN_PROVIDER = 'mock';

    vi.resetModules();
    const configModule = await import('./authorization-configuration');
    const config = configModule.getAuthorizationConfig();
    expect(config.audience).toBeNull();
    expect(config.issuer).toBeNull();
    expect(config.provider).toEqual('mock');
  });
});
