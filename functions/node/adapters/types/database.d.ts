export interface IDbConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  azureManagedIdentity: string;
  authentication: {
    type: string;
  },
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
