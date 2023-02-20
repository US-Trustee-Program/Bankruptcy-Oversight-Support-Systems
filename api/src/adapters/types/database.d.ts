export type DbRecord = {
  message: string;
  count: number;
  body: Object;
  success: boolean;
};

type QueryResults = {
  results: void | Object;
  message: string;
  success: boolean;
};

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
