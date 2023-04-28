/**
 * This is a database proxy which will use
 *   - a local in-memory database if env variable DATABASE_MOCK is set to true
 *   - an Azure SQL connection otherwise
 */

import config from '../configs/index.js';
import { PersistenceGateway } from './types/persistence-gateway';
import log from '../adapters/services/logger.service.js';

const NAMESPACE = 'DATA-ACCESS-PROXY';

/**
 * Method: proxyData
 *
 * @param table A particular primary DB table that we will be working with
 * @param mock This parameter defaults to false, which should be the normal operation.
 *               As false, it will use an environment variable to determine if it should provide
 *               an in-memory data object as a mock database, or to use an actual Azure database.
 *               This parameter is provided for Unit Tests, in which we probably want to use a local
 *               in-memory data object regardless of the environment variable set.
 * @returns An object of type PersistenceGateway
 */
async function proxyData(table: string, mock: boolean = false): Promise<PersistenceGateway | object> {
  let database: PersistenceGateway;
  if (config.dbMock || mock) {
    log.info(NAMESPACE, 'using local in-memory database');
    return await import(`./gateways/${table}.local.inmemory.gateway.js`);
  } else {
    log.info(NAMESPACE, 'using MSSQL database');
    return await import(`./gateways/${table}.azure.sql.gateway.js`);
  }
}

export default proxyData;
