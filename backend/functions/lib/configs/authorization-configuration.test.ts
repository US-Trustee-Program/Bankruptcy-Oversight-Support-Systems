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

  test('should not get provider from hostname', () => {
    process.env.CAMS_LOGIN_PROVIDER_CONFIG =
      'issuer=https://fake.provider.com/malicious-okta/default';

    let configModule;
    jest.isolateModules(() => {
      configModule = require('./authorization-configuration');
    });
    const config = configModule.getAuthorizationConfig();
    expect(config.provider).toBeNull();
  });

  test('should not get provider from path with hyphenated subdomain containing okta', () => {
    process.env.CAMS_LOGIN_PROVIDER_CONFIG =
      'issuer=https://malicious-okta.provider.com/malicious-okta/defaultt}';

    let configModule;
    jest.isolateModules(() => {
      configModule = require('./authorization-configuration');
    });
    const config = configModule.getAuthorizationConfig();
    expect(config.provider).toBeNull();
  });

  test('should get okta.com from domain name', () => {
    process.env.CAMS_LOGIN_PROVIDER_CONFIG = 'issuer=https://valid.okta.com/oauth2/default';

    let configModule;
    jest.isolateModules(() => {
      configModule = require('./authorization-configuration');
    });
    const config = configModule.getAuthorizationConfig();
    expect(config.provider).toEqual('okta');
    expect(config.audience).toEqual('api://default');
  });

  test('should return null audience from domain name', () => {
    process.env.CAMS_LOGIN_PROVIDER_CONFIG = 'issuer=https://valid.okta.com/';

    let configModule;
    jest.isolateModules(() => {
      configModule = require('./authorization-configuration');
    });
    const config = configModule.getAuthorizationConfig();
    expect(config.audience).toBeNull();
  });

  test('module should not fail to parse and initialize config', () => {
    let configModule;
    jest.isolateModules(() => {
      configModule = require('./authorization-configuration');
    });
    const config = configModule.getAuthorizationConfig();
    expect(config.audience).toBeNull();
    expect(config.issuer).toBeNull();
    expect(config.provider).toBeNull();
  });

  test('module should not fail to parse and initialize config with nonsense env var', () => {
    process.env.CAMS_LOGIN_PROVIDER_CONFIG = 'nonsense';

    let configModule;
    jest.isolateModules(() => {
      configModule = require('./authorization-configuration');
    });
    const config = configModule.getAuthorizationConfig();
    expect(config.audience).toBeNull();
    expect(config.issuer).toBeNull();
    expect(config.provider).toBeNull();
  });

  test('should get mock config if provider is "mock"', () => {
    process.env.CAMS_LOGIN_PROVIDER = 'mock';

    let configModule;
    jest.isolateModules(() => {
      configModule = require('./authorization-configuration');
    });
    const config = configModule.getAuthorizationConfig();
    expect(config.audience).toBeNull();
    expect(config.issuer).toBeNull();
    expect(config.provider).toEqual('mock');
  });
});
