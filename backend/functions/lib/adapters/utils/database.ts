import * as mssql from 'mssql';
import log from '../services/logger.service';
import { ApplicationContext } from '../types/basic';
import { DbTableFieldSpec, QueryResults } from '../types/database';

const NAMESPACE = 'DATABASE-UTILITY';

export async function executeQuery(
  context: ApplicationContext,
  database: string,
  query: string,
  input?: DbTableFieldSpec[],
): Promise<QueryResults> {
  // we should do some sanitization here to eliminate sql injection issues

  try {
    switch (database) {
      case 'ACMS_REP_SUB':
        console.log(database);
        break;
      case 'AODATEX_SUB':
        console.log(database);
        break;
      default:
        throw new Error();
    }

    const sqlConnectionPool = new mssql.ConnectionPool(
      context.config.dbConfig as unknown as mssql.config,
    );
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
