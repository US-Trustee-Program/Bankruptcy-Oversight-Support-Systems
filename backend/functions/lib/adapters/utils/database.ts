import { ConnectionPool, config } from 'mssql';
import log from '../services/logger.service';
import { ApplicationContext } from '../types/basic';
import { DbTableFieldSpec, IDbConfig, QueryResults } from '../types/database';

const NAMESPACE = 'DATABASE-UTILITY';

export async function executeQuery(
  context: ApplicationContext,
  databaseConfig: IDbConfig,
  query: string,
  input?: DbTableFieldSpec[],
): Promise<QueryResults> {
  // we should do some sanitization here to eliminate sql injection issues

  try {
    const sqlConnectionPool = new ConnectionPool(databaseConfig as unknown as config);
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
