import * as mssql from 'mssql';
import config from './config';
import logging from './logging';

const params: mssql.config = {
  user: config.mssql.user,
  password: config.mssql.pass,
  database: config.mssql.database,
  server: config.mssql.host,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

const Connect = async () =>
  new Promise<mssql.ConnectionPool>(async (resolve, reject) => {
    try {
      const connection: mssql.ConnectionPool = await mssql.connect(params);
      resolve(connection);
    } catch (error) {
      reject(error);
      return;
    }
  });

const Query = async (connection: mssql.ConnectionPool, query: string) =>
  new Promise((resolve, reject) => {
    logging.info('MSSQL', `Query: ${query}`, connection);
    const request = new mssql.Request(connection);

    try {
      const result = request.query(query);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });

export { Connect, Query };
