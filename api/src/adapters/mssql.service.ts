import * as mssql from 'mssql';
import config from '../configs/default.config';
import logging from './logging.service';
import { Connection, Request } from 'tedious';
import { DefaultAzureCredential } from '@azure/identity';

const managedIdentityClientId: string = 'befa384c-69d3-4b26-9c1a-7137f8d74c71';

// Uncomment one of the two lines depending on the identity type
//const credential = new DefaultAzureCredential(); // system-assigned identity
const credential = new DefaultAzureCredential({ managedIdentityClientId: managedIdentityClientId }); // user-assigned identity

const Connect = async () => {
  // Get token for Azure SQL Database
  const accessToken = await credential.getToken('https://database.windows.net/.default');
  console.log(accessToken);

  // Create connection to database
  const connection = new Connection({
    server: 'boss-acms-dev.database.windows.net',
    authentication: {
      type: 'azure-active-directory-access-token',
      //type: 'azure-active-directory-msi-app-service',
      //type: 'azure-active-directory-msi-vm',
      options: {
        //  token: accessToken.token
        clientId: ''
        //msiEndpoint: '',
      }
    },
    options: {
      database: 'boss-dev',
      encrypt: true,
      port: 1433
    }
  });

  //
  // Open the database connection
  connection.connect();

  return connection;
};

const Query = async (connection: mssql.Connection, query: string) => logging.info('MSSQL', `Query: ${query}`, connection);
/*
  new Promise((resolve, reject) => {
    logging.info('MSSQL', `Query: ${query}`, connection);

    const result = connection.query(query);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
  */

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
