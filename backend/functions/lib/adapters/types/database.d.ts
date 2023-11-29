import * as mssql from 'mssql';

export interface DbResult {
  success: boolean;
  message: string;
  count: number;
  body: object;
}

export interface QueryResults {
  success: boolean;
  results: void | object;
  message: string;
}

export interface DbTableFieldSpec {
  name: string;
  type: mssql.ISqlTypeFactoryWithNoParams;
  value: unknown;
}

export interface IDbConfig {
  server: string;
  port: number;
  database: string;
  user?: string;
  password?: string;
  azureManagedIdentity?: string;
  authentication?: {
    type: string;
    options?: {
      clientId: string;
    };
  };
  pool?: {
    max: number;
    min: number;
    idleTimeoutMillis: number;
  };
  options?: {
    msiEndpoint?: string;
    msiSecret?: string;
    encrypt: boolean;
    trustServerCertificate: boolean;
  };
}

export interface CosmosConfig {
  endpoint: string;
  managedIdentity: string;
  databaseName: string;
}
