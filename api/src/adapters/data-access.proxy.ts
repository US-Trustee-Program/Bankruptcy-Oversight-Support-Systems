/**
 * This is a database proxy which will use
 *   - a local in-memory database if env variable DATABASE_MOCK is set to true
 *   - an Azure SQL connection otherwise 
 */

import config from '../configs/default.config';
import { PersistenceGateway } from '../use-cases/persistence-gateway.int';

async function proxyData(): Promise<PersistenceGateway> {
  let database: PersistenceGateway;
  if (config.dbMock) {
    database = await import('./gateways/local.inmemory.gateway');
    return database;
  } else {
    database = await import('./gateways/azure.sql.gateway');
    return database;
  }
}

export default proxyData;