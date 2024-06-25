describe('Authorization config tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...process.env, AUTH_ISSUER: undefined };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('should not get provider from path', () => {
    process.env.AUTH_ISSUER = 'https://fake.provider.com/malicious-okta/default';

    let configModule;
    jest.isolateModules(() => {
      configModule = require('./authorization-configuration');
    });
    const config = configModule.getAuthorizationConfig();
    expect(config.provider).toBeNull();
  });

  test('should get okta.com from domain name', () => {
    process.env.AUTH_ISSUER = 'https://valid.okta.com/oauth2/default';

    let configModule;
    jest.isolateModules(() => {
      configModule = require('./authorization-configuration');
    });
    const config = configModule.getAuthorizationConfig();
    expect(config.provider).toEqual('okta');
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
    process.env.AUTH_ISSUER = 'nonsense';

    let configModule;
    jest.isolateModules(() => {
      configModule = require('./authorization-configuration');
    });
    const config = configModule.getAuthorizationConfig();
    expect(config.audience).toBeNull();
    expect(config.issuer).toBeNull();
    expect(config.provider).toBeNull();
  });
});
