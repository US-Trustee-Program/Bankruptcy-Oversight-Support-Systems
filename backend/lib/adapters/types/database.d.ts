import * as mssql from 'mssql';

export interface DbResult {
  body: object;
  count: number;
  message: string;
  success: boolean;
}

export interface DbTableFieldSpec {
  name: string;
  type: mssql.ISqlTypeFactoryWithNoParams;
  value: unknown;
}

export interface DocumentDbConfig {
  connectionString: string;
  databaseName: string;
}

export interface IDbConfig {
  authentication?: {
    options?: {
      clientId: string;
    };
    type: string;
  };
  database: string;
  options?: {
    encrypt: boolean;
    trustServerCertificate: boolean;
  };
  password?: string;
  pool?: {
    idleTimeoutMillis: number;
    max: number;
    min: number;
  };
  port: number;
  requestTimeout?: number;
  server: string;
  user?: string;
}

export interface QueryResults {
  message: string;
  results: object | void;
  success: boolean;
}
