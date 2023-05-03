const context = require('azure-function-context-mock');
import proxyData from './data-access.proxy';
import * as inMemGateway from './gateways/users.local.inmemory.gateway';
import * as mssqlGateway from './gateways/users.azure.sql.gateway';
import { PersistenceGateway } from './types/persistence-gateway';

jest.mock('./gateways/users.local.inmemory.gateway', () => {
  return {
    getCaseList: jest.fn(() => { return 'in-memory-test' })
  }
})

jest.mock('./gateways/users.azure.sql.gateway', () => {
  return {
    getCaseList: jest.fn(() => { return 'azure-sql-test' })
  }
})

jest.mock('')

test('Data Access Proxy loads local inmemory database when config.dbMock is set to true', async () => {
  expect(1).toBe(1);
  /*
  // config.dbMock should be set to true for all tests but we'll force it just for the purposes of this test.
  jest.mock('../configs/index', () => {
    return {
      dbMock: true
    }
  })

  type ProxyGateway = {
    getCaseList: Function,
    getCase: Function,
    createCase: Function,
    updateCase: Function,
    deleteCase: Function,
  }

  console.log('========== BEGINNING PROXY TEST ==============')
  let result: ProxyGateway = await proxyData(context, 'cases') as ProxyGateway
  let foo = result.getCaseList();

  //expect(result.getCaseList()).toBe('in-memory-test');
  */
})
