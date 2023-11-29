import { ConnectionError, ConnectionPool, MSSQLError, config } from 'mssql';
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

    // TODO : May want to refactor to just return results without the message and success
    const queryResult: QueryResults = {
      results,
      message: '',
      success: true,
    };

    log.info(applicationContext, MODULE_NAME, 'Closing connection.');

    sqlConnection.close();

    return queryResult;
  } catch (error) {
    if (isConnectionError(error)) {
      const errorMessages = [];
      // No recursive function here. Limiting this to just 2 "errors" lists deep.
      if (isAggregateError(error.originalError)) {
        error.originalError.errors.reduce((acc, e) => {
          if (isAggregateError(e)) {
            e.errors.forEach((lowestE) => {
              acc.push(lowestE.message);
            });
          } else {
            acc.push(e.message);
          }
          return acc;
        }, errorMessages);
      } else {
        errorMessages.push(error.originalError.message);
      }

      log.error(applicationContext, MODULE_NAME, 'ConnectionError', { errorMessages });
    } else if (isMssqlError(error)) {
      log.error(applicationContext, MODULE_NAME, 'MssqlError', {
        name: error.name,
        originalError: error.originalError,
      });
    } else {
      log.error(applicationContext, MODULE_NAME, error.message, error);
    }

    // TODO May want to refactor to throw CamsError and remove returning QueryResults
    const queryResult: QueryResults = {
      results: {},
      message: (error as Error).message,
      success: false,
    };
    return queryResult;
  }
}

function isMssqlError(e: unknown): e is MSSQLError {
  return e instanceof MSSQLError;
}

function isConnectionError(e: unknown): e is MSSQLError {
  return e instanceof ConnectionError;
}

type AggregateError = Error & {
  errors?: Error[];
};

function isAggregateError(e: unknown): e is AggregateError {
  return 'errors' in (e as object);
}
