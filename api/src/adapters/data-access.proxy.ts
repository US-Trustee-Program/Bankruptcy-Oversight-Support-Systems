/**
 * This is a database proxy which will use
 *   - a local in-memory database if env variable DATABASE_MOCK is set to true
 *   - an Azure SQL connection otherwise 
 */

import config from '../configs/default.config';
import { PersistenceGateway } from '../use-cases/persistence-gateway.int';

let database: PersistenceGateway;

async function loadDatabase(moduleName: string): Promise<Object> {
  return await import(moduleName);
}

if (config.dbMock) {
  import('./gateways/local.inmemory.gateway').then(db => {
    database = db;
  });
} else {
  import('./gateways/azure.sql.gateway').then(db => {
    database = db;
  });
}

export default database;