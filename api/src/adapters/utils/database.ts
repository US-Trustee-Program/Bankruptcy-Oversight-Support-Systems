import mssql from 'mssql';
import log from "../logging.service";
import { DbTableFieldSpec, QueryResults } from "../types/database";
import config from '../../configs/default.config';

const NAMESPACE = 'DATABASE-UTILITY';

function validateTableName(tableName: string) {
  return tableName.match(/^[a-z]+[a-z0-9]*$/i);
}

export async function runQuery(tableName: string, query: string, input?: DbTableFieldSpec[]): Promise<QueryResults> {
  // we should do some sanitization here to eliminate sql injection issues
  if (!validateTableName(tableName)) {
    throw new Error(`Invalid table name ${tableName}`);
  }

  try {
    const pool = new mssql.ConnectionPool(config.dbConfig);
    const connection = await pool.connect();

    log('info', 'MSSQL', `Query: ${query}`);

    const request = await connection.request();

    if (typeof input != "undefined") {
      input.forEach(item => {
        request.input(item.name, item.type, item.value);
      });
    }
    const results = await request.query(query);

    log('info', NAMESPACE, `Retrieved ${tableName}: `, results);

    const queryResult: QueryResults = {
      results,
      message: '',
      success: true
    };

    log('info', NAMESPACE, 'Closing connection.');

    connection.close();

    return queryResult;
  } catch (error) {
    log('error', NAMESPACE, (error as Error).message, error);

    const queryResult: QueryResults = {
      results: {},
      message: (error as Error).message,
      success: false
    };

    return queryResult;
  }
}
