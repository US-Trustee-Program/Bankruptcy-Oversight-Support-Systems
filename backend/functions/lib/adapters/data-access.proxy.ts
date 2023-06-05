/**
 * This is a database proxy which will use
 *   - a local in-memory database if env variable DATABASE_MOCK is set to true
 *   - an Azure SQL connection otherwise
 */

import config from '../configs/index';
import { PersistenceGateway } from './types/persistence-gateway';
import log from './services/logger.service';
import { Context } from './types/basic';
import {PacerGatewayInterface} from "./gateways/pacer.gateway.interface";

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
async function proxyData(context: Context, table: string, mock: boolean = false): Promise<PersistenceGateway | object> {
  if (config.get('dbMock') || mock) {
    log.info(context, NAMESPACE, 'using local in-memory database');
    return await import(`./gateways/${table}.local.inmemory.gateway`);
  } else {
    log.info(context, NAMESPACE, 'using MSSQL database');
    return await import(`./gateways/${table}.azure.sql.gateway`);
  }
}

async function proxyPacer(context: Context): Promise<PacerGatewayInterface> {
  if (config.get('pacerMock')) {
    log.info(context, NAMESPACE, 'using local PACER data');
    return await import(`./gateways/local.pacer.gateway.ts`);
  } else {
    log.info(context, NAMESPACE, 'using PACER API');
    return await import(`./gateways/pacer.gateway.ts`);
  }
}

export default proxyData;
