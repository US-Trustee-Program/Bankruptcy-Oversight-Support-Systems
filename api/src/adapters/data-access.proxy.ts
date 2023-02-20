/**
 * This is a database proxy which will use
 *   - a local in-memory database if env variable DATABASE_MOCK is set to true
 *   - an Azure SQL connection otherwise
 */

import config from '../configs/default.config';
import { PersistenceGateway } from './types/persistence-gateway';

async function proxyData(): Promise<PersistenceGateway> {
  let database: PersistenceGateway;
  if (config.dbMock) {
    return await import('./gateways/local.inmemory.gateway');
  } else {
    return await import('./gateways/azure.sql.gateway');
  }
}

export default proxyData;
