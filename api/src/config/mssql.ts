import * as mssql from 'mssql';
import config from './config';
import logging from './logging';
import { Connection, Request } from 'tedious';
import { DefaultAzureCredential } from '@azure/identity';

// Uncomment one of the two lines depending on the identity type
//const credential = new DefaultAzureCredential(); // system-assigned identity
const credential = new DefaultAzureCredential({ managedIdentityClientId: '784371ee-c2c8-4e71-8e19-3ae2ec348577' }); // user-assigned identity

const Connect = async () => {
  // Get token for Azure SQL Database
  const accessToken = await credential.getToken('https://database.windows.net/.default');

  // Create connection to database
  const connection = new Connection({
    server: 'boss-acms-dev.database.windows.net',
    authentication: {
      type: 'azure-active-directory-access-token',
      options: {
        token: accessToken.token
      }
    },
    options: {
      database: 'boss-dev',
      encrypt: true,
      port: 1433
    }
  });

  // Open the database connection
  connection.connect();

  return connection;
};

export { Connect };
/*
const Query = async (connection: mssql.Connection, query: string) =>
  new Promise((resolve, reject) => {
    logging.info('MSSQL', `Query: ${query}`, connection);

    const result = connection..query(query);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });

export { Connect, Query };

/*
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

*/
