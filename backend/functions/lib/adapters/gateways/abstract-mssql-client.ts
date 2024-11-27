import { config, ConnectionError, ConnectionPool, MSSQLError, IResult } from 'mssql';
import { DbTableFieldSpec, IDbConfig, QueryResults } from '../types/database';
import { Closable, deferClose } from '../../defer-close';
import { ApplicationContext } from '../types/basic';

export abstract class AbstractMssqlClient implements Closable {
  private connectionPool: ConnectionPool;
  private readonly moduleName: string;

  protected constructor(context: ApplicationContext, dbConfig: IDbConfig, childModuleName: string) {
    this.moduleName = `ABSTRACT-MSSQL-CLIENT (${childModuleName})`;
    this.connectionPool = new ConnectionPool(dbConfig as config);
    deferClose(context, this);
  }

  public async executeQuery<T = unknown>(
    context: ApplicationContext,
    query: string,
    input?: DbTableFieldSpec[],
  ): Promise<QueryResults> {
    // we should do some sanitization here to eliminate sql injection issues
    try {
      const connection = await this.connectionPool.connect();
      const request = connection.request();

      if (typeof input != 'undefined') {
        input.forEach((item) => {
          request.input(item.name, item.type, item.value);
        });
      }
      const result = (await request.query(query)) as IResult<T>;

      const queryResults: QueryResults = {
        results: result.recordset,
        message: '',
        success: true,
      };

      context.logger.info(this.moduleName, 'Closing connection.');

      await connection.close();

      return queryResults;
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
        context.logger.error(this.moduleName, 'ConnectionError', { errorMessages });
      } else if (isMssqlError(error)) {
        const newError = {
          error: {
            name: error.name, // RequestError
            description: error.message, // Timeout: Request failed to complete in 15000ms
          },
          originalError: {},
          query,
          input,
        };
        if (error.originalError) {
          newError.originalError = {
            name: error.originalError.name,
            description: error.originalError.name,
          };
        }

        context.logger.error(this.moduleName, 'MssqlError', newError);
      } else {
        context.logger.error(this.moduleName, error.message, { error, query, input });
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

  public async close(): Promise<void> {
    await this.connectionPool.close();
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
