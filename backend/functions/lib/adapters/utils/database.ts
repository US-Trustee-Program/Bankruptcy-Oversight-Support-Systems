import { ConnectionPool, config } from 'mssql';
import log from '../services/logger.service';
import { ApplicationContext } from '../types/basic';
import { DbTableFieldSpec, IDbConfig, QueryResults } from '../types/database';

const MODULE_NAME = 'DATABASE-UTILITY';

export async function executeQuery(
  applicationContext: ApplicationContext,
  databaseConfig: IDbConfig,
  query: string,
  input?: DbTableFieldSpec[],
): Promise<QueryResults> {
  // we should do some sanitization here to eliminate sql injection issues

  // TODO CAMS-14 This is where the client gets create for sql connections.
  // Do we need to create a connection pool object for this???
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

    log.info(applicationContext, MODULE_NAME, 'Closing connection.');

    sqlConnection.close();

    return queryResult;
  } catch (error) {
    // TODO CAMS-14 : current logging approach doesn't properly log useful exeception info
    applicationContext.log.error(error);

    log.error(applicationContext, MODULE_NAME, (error as Error).message, error);

    const queryResult: QueryResults = {
      results: {},
      message: (error as Error).message,
      success: false,
    };

    return queryResult;
  }
}
