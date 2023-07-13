const context = require('azure-function-context-mock');
import { applicationContextCreator } from './utils/application-context-creator';
import { ApplicationConfiguration } from '../configs/application-configuration';
import proxyData from './data-access.proxy';

const applicationContext = applicationContextCreator(context);
let originalConfig = new ApplicationConfiguration();
let dbMock = false;

jest.mock('./gateways/cases.local.inmemory.gateway', () => {
  return {
    getCaseList: jest.fn(() => {
      return 'in-memory-test';
    }),
  };
});

jest.mock('./gateways/cases.azure.sql.gateway', () => {
  return {
    getCaseList: jest.fn(() => {
      return 'azure-sql-test';
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
      getCaseList: Function;
      getCase: Function;
      createCase: Function;
      updateCase: Function;
      deleteCase: Function;
    };

    let result: ProxyGateway = (await proxyData(applicationContext, 'cases')) as ProxyGateway;

    expect(result.getCaseList()).toBe('in-memory-test');
  });

  test('Data Access Proxy should load azure mssql database when config.dbMock is set to false', async () => {
    // config.dbMock should be set to true for all tests but we'll force it just for the purposes of this test.
    dbMock = false;

    type ProxyGateway = {
      getCaseList: Function;
      getCase: Function;
      createCase: Function;
      updateCase: Function;
      deleteCase: Function;
    };

    let result: ProxyGateway = (await proxyData(applicationContext, 'cases')) as ProxyGateway;

    expect(result.getCaseList()).toBe('azure-sql-test');
  });
});
