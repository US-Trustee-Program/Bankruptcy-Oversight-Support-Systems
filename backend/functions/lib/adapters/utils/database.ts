import * as mssql from 'mssql';
import log from '../services/logger.service';
import { Context } from '../types/basic';
import { DbTableFieldSpec, QueryResults } from '../types/database';
import config from '../../configs/index';
//import { DefaultAzureCredential } from '@azure/identity';

const NAMESPACE = 'DATABASE-UTILITY';

export async function executeQuery(context: Context, query: string, input?: DbTableFieldSpec[]): Promise<QueryResults> {
  // we should do some sanitization here to eliminate sql injection issues

  try {
    // should actually not need the following.  The config should take care of it.
    // see https://learn.microsoft.com/en-us/azure/azure-sql/database/connect-query-nodejs?view=azuresql&tabs=macos
    //const credential = new DefaultAzureCredential({ managedIdentityClientId: config.dbConfig.azureManagedIdentity }); // user-assigned identity

    const sqlConnectionPool = new mssql.ConnectionPool(config.dbConfig as unknown as mssql.config);
    const sqlConnection = await sqlConnectionPool.connect();
    const sqlRequest = await sqlConnection.request();

    if (typeof input != 'undefined') {
      input.forEach((item) => {
        sqlRequest.input(item.name, item.type, item.value);
      });
    }
    const results = await sqlRequest.query(query);

    const queryResult: QueryResults = {
      results,
      message: '',
      success: true,
    };

    log.info(context, NAMESPACE, 'Closing connection.');

    sqlConnection.close();

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
