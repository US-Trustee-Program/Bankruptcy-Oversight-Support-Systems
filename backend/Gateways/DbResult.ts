import * as mssql from 'mssql';

namespace Gateways.Repositories {

  export class DbResult {

    public success: boolean;
    public message: string;
    public count: number;
    public body: Object;
  }
}
