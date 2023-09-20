/* eslint-disable @typescript-eslint/ban-types */
const context = require('azure-function-context-mock');
import { applicationContextCreator } from './utils/application-context-creator';
import proxyData from './data-access.proxy';

const applicationContext = applicationContextCreator(context);
let dbMock = true;

jest.mock('./gateways/users.local.inmemory.gateway', () => {
  return {
    login: jest.fn(() => {
      return 'in-memory-test';
    }),
  };
});

jest.mock('../configs/application-configuration', () => {
  // Require the original module!
  const originalModule = jest.requireActual('../configs/application-configuration');
  const originalConfigClass = originalModule.ApplicationConfiguration;

  class MockAppConfig extends originalConfigClass {
    get(key: string) {
      // override result conditionally on input arguments
      if (key === 'dbMock') return dbMock;
      // otherwise return using original behavior
      return super.get(key);
    }
  }

  return {
    ...originalModule,
    ApplicationConfiguration: MockAppConfig,
  };
});

describe('Testing Data Access Proxy loader', () => {
  test('Data Access Proxy should load local inmemory database when config.dbMock is set to true', async () => {
    // config.dbMock should be set to true for all tests but we'll force it just for the purposes of this test.
    dbMock = true;

    type ProxyGateway = {
      login: Function;
    };

    const result: ProxyGateway = (await proxyData(applicationContext, 'users')) as ProxyGateway;

    expect(result.login()).toBe('in-memory-test');
  });
});
