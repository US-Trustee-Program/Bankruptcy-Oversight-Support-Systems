import config from './configs';
import { AttorneyGatewayInterface } from './use-cases/attorney.gateway.interface';
import { AttorneyLocalGateway } from './adapters/gateways/attorneys.local.inmemory.gateway';
import { PacerApiGateway } from './adapters/gateways/pacer.api.gateway';
import { PacerGatewayInterface } from './adapters/types/pacer.gateway';
import { PacerLocalGateway } from './adapters/gateways/pacer.local.gateway';
import { PacerSecretsGateway } from './lib/adapters/gateways/pacer-secrets.gateway';
import { PacerTokenSecretInterface } from './adapters/gateways/pacer-token-secret.interface';

export const getPacerGateway = (): PacerGatewayInterface => {
  if (config.get('pacerMock')) {
    return new PacerLocalGateway();
  } else {
    return new PacerApiGateway();
  }
};

export const getAttorneyGateway = (): AttorneyGatewayInterface => {
  if (config.get('dbMock')) {
    return new AttorneyLocalGateway();
  } else {
    // return new AttorneyApiGateway(); // not yet implemented
  }
};

export const getPacerTokenSecretGateway = (): PacerSecretsInterface => {
    return new PacerSecretsGateway();
}
