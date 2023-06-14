const context = require('azure-function-context-mock');
import proxyData from './data-access.proxy';

jest.mock('./gateways/cases.local.inmemory.gateway', () => {
  return {
    getCaseList: jest.fn(() => { return 'in-memory-test' })
  }
})

jest.mock('./gateways/cases.azure.sql.gateway', () => {
  return {
    getCaseList: jest.fn(() => { return 'azure-sql-test' })
  }
})

let dbMock = false;

jest.mock('../configs/index', () => {
  // Require the original module!
  const originalConfig = jest.requireActual('../configs/index');

  return {
    __esModule: true, // for esModules
    default: {
      get: jest.fn((key: string) => {
        // override result conditionally on input arguments
        if (key === 'dbMock') return dbMock;
        // otherwise return using original behavior
        return originalConfig.default.get(key);
      })
    }
  };
});

describe('Testing Data Access Proxy loader', () => {
  test('Data Access Proxy should load local inmemory database when config.dbMock is set to true', async () => {
    // config.dbMock should be set to true for all tests but we'll force it just for the purposes of this test.
    dbMock = true;

    type ProxyGateway = {
      getCaseList: Function,
      getCase: Function,
      createCase: Function,
      updateCase: Function,
      deleteCase: Function,
    }

    let result: ProxyGateway = await proxyData(context, 'cases') as ProxyGateway

    expect(result.getCaseList()).toBe('in-memory-test');
  })

  test('Data Access Proxy should load azure mssql database when config.dbMock is set to false', async () => {
    // config.dbMock should be set to true for all tests but we'll force it just for the purposes of this test.
    dbMock = false;

    type ProxyGateway = {
      getCaseList: Function,
      getCase: Function,
      createCase: Function,
      updateCase: Function,
      deleteCase: Function,
    }

    let result: ProxyGateway = await proxyData(context, 'cases') as ProxyGateway

    expect(result.getCaseList()).toBe('azure-sql-test');
  })
});
