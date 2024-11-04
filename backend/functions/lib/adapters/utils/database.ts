import { ConnectionError, MSSQLError } from 'mssql';
import { ApplicationContext } from '../types/basic';
import { DbTableFieldSpec, IDbConfig, QueryResults } from '../types/database';
import { getSqlConnection } from '../../factory';

const MODULE_NAME = 'DATABASE-UTILITY';

export async function executeQuery(
  applicationContext: ApplicationContext,
  databaseConfig: IDbConfig,
  query: string,
  input?: DbTableFieldSpec[],
): Promise<QueryResults> {
  // we should do some sanitization here to eliminate sql injection issues
  try {
    const sqlConnectionPool = getSqlConnection(databaseConfig);
    // const sqlConnectionPool = getSqlConnection({
    //   ...databaseConfig,
    //   pool: { idleTimeoutMillis: 30000, max: 30000, min: 15000 },
    // });
    const sqlConnection = await sqlConnectionPool.connect();
    const sqlRequest = sqlConnection.request();

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

    applicationContext.logger.info(MODULE_NAME, 'Closing connection.');

    await sqlConnection.close();

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
          name: error.name, // RequestError
          description: error.message, // Timeout: Request failed to complete in 15000ms
        },
        originalError: {
          name: error.originalError.name,
          description: error.originalError.name,
        },
        query,
        input,
      });
    } else {
      applicationContext.logger.error(MODULE_NAME, error.message, { error, query, input });
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

function isMssqlError(e): e is MSSQLError {
  return e instanceof MSSQLError;
}

function isConnectionError(e): e is ConnectionError {
  return e instanceof ConnectionError;
}

type AggregateError = Error & {
  errors?: Error[];
};

function isAggregateError(e: unknown): e is AggregateError {
  return e && 'errors' in (e as object);
}

// export class SqlDatabase implements Closable {
//
//
//   constructor() {
//
//   }
//
//   close() {
//
//   }
// }
