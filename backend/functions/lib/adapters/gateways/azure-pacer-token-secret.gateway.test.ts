import { DefaultAzureCredential } from '@azure/identity';
import { AzurePacerSecretsGateway } from './azure-pacer-secrets.gateway';
import { NoPacerToken } from './pacer-exceptions';

const testToken = 'abcdefghijklmnopqrstuvwxyz0123456789';

describe('Azure Pacer Token KeyVault Tests', () => {
  test('savePacerTokenToSecrets should send a pacer token name and token value to Azure KeyVault setSecret method.', async () => {
    const credential = new DefaultAzureCredential();
    const mockSecretClient = new MockSecretClient('foo', credential);
    const azurePacerTokenSecretGateway = new AzurePacerSecretsGateway(mockSecretClient);

    const setSecretSpy = jest.spyOn(mockSecretClient, 'setSecret');
    const getSecretSpy = jest.spyOn(mockSecretClient, 'getSecret');
    await azurePacerTokenSecretGateway.savePacerTokenToSecrets(testToken);
    const returnedToken = await azurePacerTokenSecretGateway.getPacerTokenFromSecrets();

    expect(setSecretSpy).toHaveBeenCalled();
    expect(getSecretSpy).toHaveBeenCalled();
    expect(returnedToken).toBe(testToken);
  });

  test('should throw NoPacerToken error when secretsGateway cannot find the PACER token', async () => {
    const credential = new DefaultAzureCredential();
    const pacerTokenName = process.env.PACER_TOKEN_SECRET_NAME;
    const getSecretMock = () => { throw Error(`${pacerTokenName} was not found in this key vault`); }

    const mockSecretClient = new MockSecretClient('foo', credential, { getSecret: getSecretMock });
    const azurePacerTokenSecretGateway = new AzurePacerSecretsGateway(mockSecretClient);

    try {
      await azurePacerTokenSecretGateway.getPacerTokenFromSecrets();
    } catch (e) {
      expect(e).toBeInstanceOf(NoPacerToken);
    }
  });
});
