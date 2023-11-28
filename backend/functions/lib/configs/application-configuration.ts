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

  // TODO CAMS-14 MAY Need to be refactor here for managed identity
  private getDbConfig(database: string): IDbConfig {
    const server = process.env.MSSQL_HOST;
    const port: number = Number(process.env.MSSQL_PORT) || 1433;
    const user = process.env.MSSQL_USER;
    const password = process.env.MSSQL_PASS;
    const encrypt: boolean = Boolean(process.env.MSSQL_ENCRYPT);
    const trustServerCertificate: boolean = Boolean(process.env.MSSQL_TRUST_UNSIGNED_CERT);
    const type = process.env.MSSQL_AUTH_TYPE || 'azure-active-directory-msi-app-service';
    const clientId = process.env.MSSQL_MANAGED_IDENTITY;
    /*
    Authentication types supported using managed identity
      azure-active-directory-default
      azure-active-directory-msi-app-service
    */

    const useSqlAuth = password && password.length > 0;

    const config: IDbConfig = useSqlAuth
      ? {
          server,
          port,
          database,
          user,
          password,
        }
      : {
          server,
          port,
          database,
          authentication: {
            type,
          },
        };

    config.pool = {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30 * 1000,
    };

    config.options = {
      encrypt,
      trustServerCertificate,
    };

    if (clientId) {
      config.options.clientId = clientId;
    }

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
