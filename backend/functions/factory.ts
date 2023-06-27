import config from './lib/configs';
import { PacerLocalGateway } from './lib/adapters/gateways/pacer.local.gateway';
import { PacerApiGateway } from './lib/adapters/gateways/pacer.api.gateway';
import { PacerGatewayInterface } from './lib/use-cases/pacer.gateway.interface';
import { AzurePacerTokenSecretGateway } from './lib/adapters/gateways/azure-pacer-token-secret.gateway';
import { PacerTokenSecretInterface } from './lib/adapters/gateways/pacer-token-secret.interface';

const getPacerGateway = (): PacerGatewayInterface => {
    if (config.get('pacerMock')) {
        return new PacerLocalGateway();
    } else {
        return new PacerApiGateway();
    }
}

const getPacerTokenSecretGateway = (): PacerTokenSecretInterface => {
    return new AzurePacerTokenSecretGateway();
}

export { getPacerGateway, getPacerTokenSecretGateway };
