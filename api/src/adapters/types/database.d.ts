export type DbRecord = {
  success: boolean;
  message: string;
  count: number;
  body: Object;
};

export type QueryResults = {
  success: boolean;
  results: void | Object;
  message: string;
};

export type DbTableFieldSpec = {
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
