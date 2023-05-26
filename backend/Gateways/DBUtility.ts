import { Context } from "../functions/lib/adapters/types/basic";
import { DbTableFieldSpec, QueryResults } from "../functions/lib/adapters/types/database";
import config from "../functions/lib/configs";
import * as mssql from 'mssql';
import log from "../functions/lib/adapters/services/logger.service";

namespace Gateways.DB {

  export class DbUtility {

    validateTableName(tableName: string) {
      return tableName.match(/^[a-z]+[a-z0-9]*$/i);
    }

    async executeQuery(context: Context, tableName: string, query: string, input?: DbTableFieldSpec[]): Promise<QueryResults> {

      try {

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

        log.info(context, "NAMESPACE", 'Closing connection.');

        sqlConnection.close();

        return queryResult;


      } catch (exception) {

        log.error(context, "NAMESPACE", (exception as Error).message, exception);

        const queryResult: QueryResults = {
          results: {},
          message: (exception as Error).message,
          success: false,

        }

        return queryResult;
      }
    }
  }
}