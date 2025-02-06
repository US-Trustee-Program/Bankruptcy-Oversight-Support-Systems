import { AbstractMssqlClient } from '../abstract-mssql-client';
import { AcmsTempGateway } from '../../../use-cases/gateways.types';

export class AcmsTempGatewayImpl extends AbstractMssqlClient implements AcmsTempGateway {
  public foo() {}
}
