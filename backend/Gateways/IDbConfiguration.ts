export namespace Gateways.Repositories {

  export interface IDbConfiguration {

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
}