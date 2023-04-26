import * as mssql from 'mssql';
import log from '../services/logger.service.js';
import { LogContext } from '../types/basic.d';
import { DbTableFieldSpec, IDbConfig, QueryResults } from '../types/database.js';
import config from '../../configs/index.js';
//import { DefaultAzureCredential } from '@azure/identity';

const NAMESPACE = 'DATABASE-UTILITY';

function validateTableName(tableName: string) {
  return tableName.match(/^[a-z]+[a-z0-9]*$/i);
}

export async function runQuery(context: LogContext, tableName: string, query: string, input?: DbTableFieldSpec[]): Promise<QueryResults> {
  // we should do some sanitization here to eliminate sql injection issues

  try {
    // should actually not need the following.  The config should take care of it.
    // see https://learn.microsoft.com/en-us/azure/azure-sql/database/connect-query-nodejs?view=azuresql&tabs=macos
    //const credential = new DefaultAzureCredential({ managedIdentityClientId: config.dbConfig.azureManagedIdentity }); // user-assigned identity
    const pool = new mssql.ConnectionPool(config.dbConfig as unknown as mssql.config);
    const connection = await pool.connect();

    const request = await connection.request();

    if (typeof input != 'undefined') {
      input.forEach((item) => {
        request.input(item.name, item.type, item.value);
      });
    }
    const results = await request.query(query);

    const queryResult: QueryResults = {
      results,
      message: '',
      success: true,
    };

    log.info(context, NAMESPACE, 'Closing connection.');

    connection.close();

    return queryResult;
  } catch (error) {
    log.error(context, NAMESPACE, (error as Error).message, error);

    const queryResult: QueryResults = {
      results: {},
      message: (error as Error).message,
      success: false,
    };

    return queryResult;
  }
}
