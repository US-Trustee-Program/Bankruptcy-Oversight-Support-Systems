import * as dotenv from 'dotenv';
import { ServerType, AppConfig } from '../adapters/types/basic';
import { CosmosConfig, IDbConfig } from '../adapters/types/database';

dotenv.config();

export class ApplicationConfiguration implements AppConfig {
  public readonly server: ServerType;
  public readonly dxtrDbConfig: IDbConfig;
  public readonly dbMock: boolean;
  public readonly cosmosConfig: CosmosConfig;
  public readonly featureFlagKey: string;

  constructor() {
    this.dbMock = process.env.DATABASE_MOCK?.toLowerCase() === 'true';
    this.server = this.getAppServerConfig();
    this.dxtrDbConfig = this.getDbConfig(process.env.MSSQL_DATABASE_DXTR);
    this.cosmosConfig = this.getCosmosConfig();
    this.featureFlagKey = process.env.FEATURE_FLAG_SDK_KEY;
  }

  private getAppServerConfig(): ServerType {
    return {
      hostname: process.env.SERVER_HOSTNAME || 'localhost',
      port: (process.env.SERVER_PORT || 8080) as number,
    };
  }

  private getDbConfig(database: string): IDbConfig {
    const server = process.env.MSSQL_HOST;
    const port: number = Number(process.env.MSSQL_PORT) || 1433;
    const encrypt: boolean = Boolean(process.env.MSSQL_ENCRYPT);
    const trustServerCertificate: boolean = Boolean(process.env.MSSQL_TRUST_UNSIGNED_CERT);
    const type = process.env.MSSQL_AUTH_TYPE || ' azure-active-directory-default';
    const user = process.env.MSSQL_USER;
    const password = process.env.MSSQL_PASS;
    const clientId = process.env.MSSQL_CLIENT_ID; // User Identity client

    const config: IDbConfig = {
      server,
      port,
      database,
    };

    const useSqlAuth = password && password.length > 0;
    if (useSqlAuth) {
      config.user = user;
      config.password = password;
    } else {
      config.authentication = {
        type,
      };

      // If client id is not set here, ensure that AZURE_CLIENT_ID is set when using DefaultAzureCredential
      if (clientId) {
        config.authentication.options = { clientId };
      }
    }

    // Override auth type value to mock if this environment variable is set to true
    if (process.env.DATABASE_MOCK?.toLowerCase() === 'true') {
      config.authentication.type = 'mock';
    }

    config.pool = {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30 * 1000,
    };

    config.options = {
      encrypt,
      trustServerCertificate,
    };

    return config;
  }

  private getCosmosConfig(): CosmosConfig {
    return {
      endpoint: process.env.COSMOS_ENDPOINT,
      managedIdentity: process.env.COSMOS_MANAGED_IDENTITY,
      databaseName: process.env.COSMOS_DATABASE_NAME,
    };
  }

  public get(prop: string) {
    if (Object.prototype.hasOwnProperty.call(this, prop)) {
      return this[prop];
    }
  }
}
