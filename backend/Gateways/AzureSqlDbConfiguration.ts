// @ts-ignore
import * as process from 'NodeJS.Process';

interface IDbConfiguration {
  ServerName: string;
  DatabaseName: string;
  UserName: string;
  Password: string;
  AzureManagedIdentity: string;
  Authentication: { type: string; },
  Pool: {
    maximum: number;
    minimum: number;
    idleTimeoutInMilliseconds: number;

  };
  Options: {
    encrypt: boolean | undefined;
    trustServerCertificate: boolean | undefined;
  };

}


namespace Gateways.Repositories {

  export class AzureSqlDbConfiguration implements IDbConfiguration {

    ServerName: process.env.MSSQL_HOST;
    DatabaseName: process.env.MSSQL_DATABASE;
    UserName: process.env.MSSQL_USER;
    Password: '';

    Authentication: { type: 'azure-active-directory-msi-app-service' };
    Pool: { maximum: 10; minimum: 0; idleTimeoutInMilliseconds: 30000 };

    AzureManagedIdentity: process.env.AZURE_MANAGED_IDENTITY ;

    Options: { encrypt: process.env.MSSQL_ENCRYPT; trustServerCertificate: process.env.MSSQL_TRUST_UNSIGNED_CERT };



  }
}
