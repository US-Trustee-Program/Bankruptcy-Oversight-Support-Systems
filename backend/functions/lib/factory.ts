import { ApplicationConfiguration } from './configs/application-configuration';
import { AttorneyGatewayInterface } from './use-cases/attorney.gateway.interface';
import { AttorneyLocalGateway } from './adapters/gateways/attorneys.local.inmemory.gateway';
import { PacerApiGateway } from './adapters/gateways/pacer.api.gateway';
import { PacerGatewayInterface } from './use-cases/pacer.gateway.interface';
import { PacerLocalGateway } from './adapters/gateways/pacer.local.gateway';
import { PacerSecretsGateway } from '../lib/adapters/gateways/pacer-secrets.gateway';
import { PacerSecretsInterface } from './adapters/gateways/pacer-secrets.interface';

export const getPacerGateway = (): PacerGatewayInterface => {
  const config: ApplicationConfiguration = new ApplicationConfiguration();

  if (config.get('pacerMock')) {
    return new PacerLocalGateway();
  } else {
    return new PacerApiGateway();
  }
};

export const getAttorneyGateway = (): AttorneyGatewayInterface => {
  const config: ApplicationConfiguration = new ApplicationConfiguration();

  if (config.get('dbMock')) {
    return new AttorneyLocalGateway();
  } else {
    // return new AttorneyApiGateway(); // not yet implemented
  }
};

export const getPacerTokenSecretGateway = (): PacerSecretsInterface => {
  return new PacerSecretsGateway();
};
