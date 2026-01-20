import * as dotenv from 'dotenv';
import { ServerType } from '../adapters/types/basic';
import { DocumentDbConfig, IDbConfig } from '../adapters/types/database';
import { AuthorizationConfig, UserGroupGatewayConfig } from '../adapters/types/authorization';
import { getAuthorizationConfig } from './authorization-configuration';
import { getUserGroupGatewayConfig } from './user-groups-gateway-configuration';
import { SearchConfig, getSearchConfig } from './search-config';

dotenv.config();

export class ApplicationConfiguration {
  public readonly server: ServerType;
  public readonly dxtrDbConfig: IDbConfig;
  public readonly acmsDbConfig: IDbConfig;
  public readonly dbMock: boolean;
  public readonly documentDbConfig: DocumentDbConfig;
  public readonly featureFlagKey: string;
  public readonly authConfig: AuthorizationConfig;
  public readonly userGroupGatewayConfig: UserGroupGatewayConfig;
  public readonly search: SearchConfig;

  constructor() {
    this.dbMock = process.env.DATABASE_MOCK?.toLowerCase() === 'true';
    this.server = this.getAppServerConfig();
    this.dxtrDbConfig = this.getDxtrDbConfig(process.env.MSSQL_DATABASE_DXTR);
    this.acmsDbConfig = this.getAcmsDbConfig(process.env.ACMS_MSSQL_DATABASE);
    this.documentDbConfig = this.getDocumentDbConfig();
    this.featureFlagKey = process.env.FEATURE_FLAG_SDK_KEY;
    this.authConfig = getAuthorizationConfig();
    this.userGroupGatewayConfig = getUserGroupGatewayConfig();
    this.search = getSearchConfig();
  }

  private getAppServerConfig(): ServerType {
    return {
      hostname: process.env.SERVER_HOSTNAME || 'localhost',
      port: (process.env.SERVER_PORT || 8080) as number,
    };
  }

  private getDxtrDbConfig(database: string): IDbConfig {
    const server = process.env.MSSQL_HOST;
    const port: number = Number(process.env.MSSQL_PORT) || 1433;
    const encrypt: boolean = Boolean(process.env.MSSQL_ENCRYPT);
    const trustServerCertificate: boolean = Boolean(process.env.MSSQL_TRUST_UNSIGNED_CERT);
    const authType = process.env.MSSQL_AUTH_TYPE || 'azure-active-directory-default';
    const user = process.env.MSSQL_USER;
    const password = process.env.MSSQL_PASS;
    const identityClientId = process.env.MSSQL_CLIENT_ID;
    const requestTimeout = parseInt(process.env.MSSQL_REQUEST_TIMEOUT ?? '15000');

    const config: IDbConfig = {
      server,
      port,
      database,
      requestTimeout,
    };

    const useSqlAuth = user && password;
    if (useSqlAuth) {
      config.user = user;
      config.password = password;
    } else {
      config.authentication = {
        type: authType,
      };

      // If client id is not set here, ensure that AZURE_CLIENT_ID is set when using DefaultAzureCredential
      if (identityClientId) {
        config.authentication.options = { clientId: identityClientId };
      }
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

  // TODO: This and getDxtrDbConfig are gross. Refactor when we feel we really want to clean this up.
  private getAcmsDbConfig(database: string): IDbConfig {
    const server = process.env.ACMS_MSSQL_HOST;
    const port: number = Number(process.env.ACMS_MSSQL_PORT) || 1433;
    const encrypt: boolean = Boolean(process.env.ACMS_MSSQL_ENCRYPT);
    const trustServerCertificate: boolean = Boolean(process.env.ACMS_MSSQL_TRUST_UNSIGNED_CERT);
    const authType = process.env.ACMS_MSSQL_AUTH_TYPE || 'azure-active-directory-default';
    const user = process.env.ACMS_MSSQL_USER;
    const password = process.env.ACMS_MSSQL_PASS;
    const identityClientId = process.env.ACMS_MSSQL_CLIENT_ID;
    const requestTimeout = parseInt(process.env.ACMS_MSSQL_REQUEST_TIMEOUT ?? '15000');

    const config: IDbConfig = {
      server,
      port,
      database,
      requestTimeout,
    };

    const useSqlAuth = user && password;
    if (useSqlAuth) {
      config.user = user;
      config.password = password;
    } else {
      config.authentication = {
        type: authType,
      };

      // If client id is not set here, ensure that AZURE_CLIENT_ID is set when using DefaultAzureCredential
      if (identityClientId) {
        config.authentication.options = { clientId: identityClientId };
      }
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

  private getDocumentDbConfig(): DocumentDbConfig {
    return {
      databaseName: process.env.COSMOS_DATABASE_NAME,
      connectionString: process.env.MONGO_CONNECTION_STRING,
    };
  }

  public get(prop: string) {
    if (Object.prototype.hasOwnProperty.call(this, prop)) {
      return this[prop];
    }
  }
}
