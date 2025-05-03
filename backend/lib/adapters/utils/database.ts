import { ConnectionError, ConnectionPool, MSSQLError } from 'mssql';

import { deferClose } from '../../deferrable/defer-close';
import { getSqlConnection } from '../../factory';
import { ApplicationContext } from '../types/basic';
import { DbTableFieldSpec, IDbConfig, QueryResults } from '../types/database';

const MODULE_NAME = 'DATABASE-UTILITY';
let sqlConnectionPool: ConnectionPool;

type AggregateError = Error & {
  errors?: Error[];
};

export async function executeQuery(
  applicationContext: ApplicationContext,
  databaseConfig: IDbConfig,
  query: string,
  input?: DbTableFieldSpec[],
): Promise<QueryResults> {
  // we should do some sanitization here to eliminate sql injection issues
  try {
    if (!sqlConnectionPool) {
      sqlConnectionPool = getSqlConnection(databaseConfig);
      deferClose(sqlConnectionPool);
    }

    if (!sqlConnectionPool.connected) await sqlConnectionPool.connect();
    const sqlRequest = sqlConnectionPool.request();

    if (typeof input != 'undefined') {
      input.forEach((item) => {
        sqlRequest.input(item.name, item.type, item.value);
      });
    }
    const results = await sqlRequest.query(query);

    const queryResult: QueryResults = {
      message: '',
      results,
      success: true,
    };

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
      }
      errorMessages.push(error.message);
      applicationContext.logger.error(MODULE_NAME, 'ConnectionError', { errorMessages });
    } else if (isMssqlError(error)) {
      applicationContext.logger.error(MODULE_NAME, 'MssqlError', {
        error: {
          description: error.message, // Timeout: Request failed to complete in 15000ms
          name: error.name, // RequestError
        },
        input,
        originalError: {
          description: error.originalError.name,
          name: error.originalError.name,
        },
        query,
      });
    } else {
      applicationContext.logger.error(MODULE_NAME, error.message, { error, input, query });
    }

    // TODO May want to refactor to throw CamsError and remove returning QueryResults
    const queryResult: QueryResults = {
      message: (error as Error).message,
      results: {},
      success: false,
    };
    return queryResult;
  }
}

function isAggregateError(e: unknown): e is AggregateError {
  return e && 'errors' in (e as object);
}

function isConnectionError(e): e is ConnectionError {
  return e instanceof ConnectionError;
}

function isMssqlError(e): e is MSSQLError {
  return e instanceof MSSQLError;
}
