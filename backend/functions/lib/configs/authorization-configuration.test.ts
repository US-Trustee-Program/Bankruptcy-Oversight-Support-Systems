import * as dotenv from 'dotenv';
import { getAuthorizationConfig } from './authorization-configuration';

describe.skip('Authorization config tests', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test('should not get provider from path', () => {
    jest.spyOn(dotenv, 'config').mockReturnValue({
      parsed: { AUTH_ISSUER: 'https://fake.provider.com/malicious-okta/default' },
    });
    const config = getAuthorizationConfig();
    expect(config.provider).toBeNull();
  });

  test('should get okta.com from domain name', () => {
    jest.spyOn(dotenv, 'config').mockReturnValue({
      parsed: { AUTH_ISSUER: 'https://valid.okta.com/oauth2/default' },
    });
    const config = getAuthorizationConfig();
    expect(config.provider).toEqual('okta');
  });
});
