import mssql from 'mssql';
import log from '../logging.service.js';
import { DbTableFieldSpec, QueryResults } from '../types/database.js';
import config from '../../configs/default.config.js';
//import { DefaultAzureCredential } from '@azure/identity';

const NAMESPACE = 'DATABASE-UTILITY';

function validateTableName(tableName: string) {
  return tableName.match(/^[a-z]+[a-z0-9]*$/i);
}

export async function runQuery(tableName: string, query: string, input?: DbTableFieldSpec[]): Promise<QueryResults> {
  // we should do some sanitization here to eliminate sql injection issues
  /*
   * Why am I doing this? Perhaps when using this generic runQuery for things like deletes and updates.
  if (!validateTableName(tableName)) {
    throw new Error(`Invalid table name ${tableName}`);
  }
  */

  try {
    // should actually not need the following.  The config should take care of it.
    // see https://learn.microsoft.com/en-us/azure/azure-sql/database/connect-query-nodejs?view=azuresql&tabs=macos
    //const credential = new DefaultAzureCredential({ managedIdentityClientId: config.dbConfig.azureManagedIdentity }); // user-assigned identity
    const pool = new mssql.ConnectionPool(config.dbConfig);
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

    log('info', NAMESPACE, 'Closing connection.');

    connection.close();

    return queryResult;
  } catch (error) {
    log('error', NAMESPACE, (error as Error).message, error);

    const queryResult: QueryResults = {
      results: {},
      message: (error as Error).message,
      success: false,
    };

    return queryResult;
  }
}
