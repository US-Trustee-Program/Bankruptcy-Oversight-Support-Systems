import * as dotenv from 'dotenv';
import { IDbConfig } from '../adapters/types/database';

dotenv.config();

const dbConfig: IDbConfig = {
  server: process.env.MSSQL_HOST,
  database: process.env.MSSQL_DATABASE,
  user: process.env.MSSQL_USER,
  password: '',
  azureManagedIdentity: process.env.AZURE_MANAGED_IDENTITY || '',
  authentication: {
    type: 'azure-active-directory-msi-app-service',
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: Boolean(process.env.MSSQL_ENCRYPT),
    trustServerCertificate: Boolean(process.env.MSSQL_TRUST_UNSIGNED_CERT),
  },
};

if ( dbConfig.azureManagedIdentity.length < 1 && process.env.MSSQL_PASS && process.env.MSSQL_PASS.length > 0) {
  dbConfig.password = process.env.MSSQL_PASS;
  dbConfig.authentication.type = 'default';
} else if (process.env.DATABASE_MOCK?.toLowerCase() === 'true') {
  dbConfig.authentication.type = 'mock';
} else {
  throw Error('No Database authentication type specified');
}

export default dbConfig;
