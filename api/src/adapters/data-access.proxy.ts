/**
 * This is a database proxy which will use
 *   - a local in-memory database if env variable DATABASE_MOCK is set to true
 *   - an Azure SQL connection otherwise
 */

import config from '../configs/default.config';
import { PersistenceGateway } from './types/persistence-gateway';

async function proxyData(table: string): Promise<PersistenceGateway | object> {
  let database: PersistenceGateway;
  if (config.dbMock) {
    console.log('using local in-memory database');
    return await import(`./gateways/${table}.local.inmemory.gateway`);
  } else {
    console.log('using MSSQL database');
    return await import(`./gateways/${table}.azure.sql.gateway`);
  }
}

export default proxyData;
