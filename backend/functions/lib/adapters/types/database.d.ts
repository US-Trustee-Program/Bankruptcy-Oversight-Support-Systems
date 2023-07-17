import * as mssql from 'mssql';

export interface DbResult {
  success: boolean;
  message: string;
  count: number;
  body: Object;
}

export interface QueryResults {
  success: boolean;
  results: void | Object;
  message: string;
}

export interface DbTableFieldSpec {
  name: string;
  type: mssql.ISqlTypeFactoryWithNoParams;
  value: any;
}

export interface IDbConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  azureManagedIdentity: string;
  authentication: {
    type: string;
  };
  pool: {
    max: number;
    min: number;
    idleTimeoutMillis: number;
  };
  options: {
    encrypt: boolean | undefined;
    trustServerCertificate: boolean | undefined;
  };
}
