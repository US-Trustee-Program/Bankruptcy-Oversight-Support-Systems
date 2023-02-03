import mysql from 'mysql2';
import config from './config';
import logging from './logging';

const params = {
  user: config.mssql.user,
  password: config.mssql.pass,
  host: config.mssql.host,
  database: config.mssql.database
};

const Connect = async () =>
  new Promise<mysql.Connection>((resolve, reject) => {
    const connection = mysql.createConnection(params);

    connection.connect((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(connection);
    });
  });

const Query = async (connection: mysql.Connection, query: string) =>
  new Promise((resolve, reject) => {
    logging.info('MySQL', `Query: ${query}`, connection);
    connection.query(query, connection, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });
  });

export { Connect, Query };
