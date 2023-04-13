import dotenv from 'dotenv';
import { IDbConfig } from '../adapters/types/database.d';

dotenv.config();

const DB_MOCK = process.env.DATABASE_MOCK?.toLowerCase() === 'true';
const MSSQL_HOST = process.env.MSSQL_HOST || 'localhost';
const MSSQL_DATABASE = process.env.MSSQL_DATABASE || 'nodebooks';
const MSSQL_USER = process.env.MSSQL_USER || 'root';
const MSSQL_PASS = process.env.MSSQL_PASS || '';
const MSSQL_ENCRYPT = process.env.MSSQL_ENCRYPT || 'true';
const MSSQL_TRUST_UNSIGNED_CERT = process.env.MSSQL_TRUST_UNSIGNED_CERT || 'false';
const AZURE_MANAGED_IDENTITY = process.env.AZURE_MANAGED_IDENTITY || '';

const dbConfig: IDbConfig = {
  server: MSSQL_HOST,
  database: MSSQL_DATABASE,
  user: MSSQL_USER,
  password: '',
  azureManagedIdentity: AZURE_MANAGED_IDENTITY,
  authentication: {
    type: 'azure-active-directory-msi-app-service',
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: Boolean(MSSQL_ENCRYPT),
    trustServerCertificate: Boolean(MSSQL_TRUST_UNSIGNED_CERT),
  },
};

if (AZURE_MANAGED_IDENTITY.length < 1 && MSSQL_PASS.length > 0) {
  dbConfig.password = MSSQL_PASS;
  dbConfig.authentication.type = 'default';
} else if (DB_MOCK) {
  dbConfig.authentication.type = 'mock';
} else {
  throw Error('No Database authentication type specified');
}

export default dbConfig;
