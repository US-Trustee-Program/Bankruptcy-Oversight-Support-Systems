import dotenv from 'dotenv';

dotenv.config();

const MSSQL_HOST = process.env.MSSQL_HOST || 'localhost';
const MSSQL_DATABASE = process.env.MSSQL_DATABASE || 'nodebooks';
const MSSQL_USER = process.env.MSSQL_HOST || 'root';
const MSSQL_PASS = process.env.MSSQL_HOST || '';
const MSSQL_ENCRYPT = process.env.MSSQL_ENCRYPT || 'true';
const MSSQL_TRUST_UNSIGNED_CERT = process.env.MSSQL_TRUST_UNSIGNED_CERT || 'false';

const MSSQL = {
  server: MSSQL_HOST,
  database: MSSQL_DATABASE,
  user: MSSQL_USER,
  password: MSSQL_PASS,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: Boolean(MSSQL_ENCRYPT),
    trustServerCertificate: Boolean(MSSQL_TRUST_UNSIGNED_CERT)
  }
};

const SERVER_HOSTNAME = process.env.SERVER_HOSTNAME || 'localhost';
const SERVER_PORT = process.env.SERVER_PORT || 8080;

const SERVER = {
  hostname: SERVER_HOSTNAME,
  port: SERVER_PORT
};

const config = {
  mssql: MSSQL,
  server: SERVER
};

export default config;
