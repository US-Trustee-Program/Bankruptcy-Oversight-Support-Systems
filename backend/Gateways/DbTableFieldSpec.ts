import * as mssql from 'mssql';

namespace Gateways.Repositories {

  export class DbTableFieldSpecification {

    name: string;
    type: mssql.ISqlTypeFactoryWithNoParams;
    value: any;

  }
}
