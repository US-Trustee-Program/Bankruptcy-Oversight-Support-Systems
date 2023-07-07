import config from './lib/configs';
import { PacerLocalGateway } from './lib/adapters/gateways/pacer.local.gateway';
import { PacerApiGateway } from './lib/adapters/gateways/pacer.api.gateway';
import { PacerGatewayInterface } from './lib/use-cases/pacer.gateway.interface';
import { PacerSecretsGateway } from './lib/adapters/gateways/pacer-secrets.gateway';
import { PacerSecretsInterface } from './lib/adapters/gateways/pacer-secrets.interface';

const getPacerGateway = (): PacerGatewayInterface => {
  if (config.get('pacerMock')) {
    return new PacerLocalGateway();
  } else {
    return new PacerApiGateway();
  }
};

const getPacerTokenSecretGateway = (): PacerSecretsInterface => {
    return new PacerSecretsGateway();
}

export { getPacerGateway, getPacerTokenSecretGateway };
