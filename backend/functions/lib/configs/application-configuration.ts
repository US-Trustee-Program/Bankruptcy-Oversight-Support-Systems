import * as dotenv from 'dotenv';
import { ServerType, AppConfig } from '../adapters/types/basic';
import { CosmosConfig, IDbConfig } from '../adapters/types/database';

dotenv.config();

export class ApplicationConfiguration implements AppConfig {
  public readonly server: ServerType;
  public readonly acmsDbConfig: IDbConfig;
  public readonly dxtrDbConfig: IDbConfig;
  public readonly dbMock: boolean;
  public readonly cosmosConfig: CosmosConfig;

  constructor() {
    this.dbMock = process.env.DATABASE_MOCK?.toLowerCase() === 'true';

    this.server = this.getAppServerConfig();
    this.acmsDbConfig = this.getDbConfig(process.env.MSSQL_DATABASE);
    this.dxtrDbConfig = this.getDbConfig(process.env.MSSQL_DATABASE_DXTR);
    this.cosmosConfig = this.getCosmosConfig();
  }

  private getAppServerConfig(): ServerType {
    return {
      hostname: process.env.SERVER_HOSTNAME || 'localhost',
      port: (process.env.SERVER_PORT || 8080) as number,
    };
  }

  private getDbConfig(database: string): IDbConfig {
    const dbConfig: IDbConfig = {
      server: process.env.MSSQL_HOST,
      database: database,
      user: process.env.MSSQL_USER,
      password: '',
      azureManagedIdentity: process.env.AZURE_MANAGED_IDENTITY || '',
      authentication: {
        type: 'azure-active-directory-msi-app-service',
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
      options: {
        encrypt: Boolean(process.env.MSSQL_ENCRYPT),
        trustServerCertificate: Boolean(process.env.MSSQL_TRUST_UNSIGNED_CERT),
      },
    };

    if (
      dbConfig.azureManagedIdentity.length < 1 &&
      process.env.MSSQL_PASS &&
      process.env.MSSQL_PASS.length > 0
    ) {
      dbConfig.password = process.env.MSSQL_PASS;
      dbConfig.authentication.type = 'default';
    } else if (process.env.DATABASE_MOCK?.toLowerCase() === 'true') {
      dbConfig.authentication.type = 'mock';
    } else {
      throw Error('No Database authentication type specified');
    }

    return dbConfig;
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
