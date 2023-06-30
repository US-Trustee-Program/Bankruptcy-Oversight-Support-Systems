import { DefaultAzureCredential } from '@azure/identity';
import { AzurePacerTokenSecretGateway } from './azure-pacer-token-secret.gateway';
import {
  GetSecretOptions,
  KeyVaultSecret,
  SecretClient,
  SecretProperties,
  SetSecretOptions,
} from '@azure/keyvault-secrets';
import { NoPacerToken } from "./pacer-exceptions";

const testToken = 'abcdefghijklmnopqrstuvwxyz0123456789';

class MockSecretClient extends SecretClient {
  private token: string;

  constructor(
    _tokenName: string,
    _azureCredential: DefaultAzureCredential,
    functions?: { setSecret?: any; getSecret?: any },
  ) {
    super(_tokenName, _azureCredential);
    if (functions?.setSecret) {
      this.setSecret = functions.setSecret;
    }
    if (functions?.getSecret) {
      this.getSecret = functions.getSecret;
    }
  }

  setSecret(
    secretName: string,
    value: string,
    options?: SetSecretOptions,
  ): Promise<KeyVaultSecret> {
    this.token = value;

    const properties: SecretProperties = {
      vaultUrl: '',
      name: '',
    };

    const keyVaultSecret: KeyVaultSecret = {
      properties,
      value,
      name: secretName,
    };

    return Promise.resolve(keyVaultSecret);
  }

  getSecret(secretName: string, options?: GetSecretOptions): Promise<KeyVaultSecret> {
    const properties: SecretProperties = {
      vaultUrl: '',
      name: '',
    };

    const keyVaultSecret: KeyVaultSecret = {
      properties,
      value: this.token,
      name: secretName,
    };

    return Promise.resolve(keyVaultSecret);
  }
}

describe('Azure Pacer Token KeyVault Tests', () => {
  test('savePacerTokenToSecrets should send a pacer token name and token value to Azure KeyVault setSecret method.', async () => {
    const credential = new DefaultAzureCredential();
    const mockSecretClient = new MockSecretClient('foo', credential);
    const azurePacerTokenSecretGateway = new AzurePacerTokenSecretGateway(mockSecretClient);

    const setSecretSpy = jest.spyOn(mockSecretClient, 'setSecret');
    const getSecretSpy = jest.spyOn(mockSecretClient, 'getSecret');
    await azurePacerTokenSecretGateway.savePacerTokenToSecrets(testToken);
    const returnedToken = await azurePacerTokenSecretGateway.getPacerTokenFromSecrets();

    expect(setSecretSpy).toHaveBeenCalled();
    expect(getSecretSpy).toHaveBeenCalled();
    expect(returnedToken).toBe(testToken);
  });

  test('should throw error when setSecret return token name that does not match', async () => {
    const credential = new DefaultAzureCredential();
    // define mock setSecret
    const setSecretMock = (
      secretName: string,
      value: string,
      options?: SetSecretOptions,
    ): Promise<KeyVaultSecret> => {
      const properties: SecretProperties = {
        vaultUrl: '',
        name: '',
      };

      const keyVaultSecret: KeyVaultSecret = {
        properties,
        value,
        name: 'some random value',
      };

      return Promise.resolve(keyVaultSecret);
    };

    const mockSecretClient = new MockSecretClient('foo', credential, { setSecret: setSecretMock });
    const azurePacerTokenSecretGateway = new AzurePacerTokenSecretGateway(mockSecretClient);

    try {
      await azurePacerTokenSecretGateway.savePacerTokenToSecrets(testToken);
    } catch (e) {
      expect(e).toEqual(Error('New KeyVault token not saved'));
    }
  });

  test('should throw error when getSecret throws an error ', async () => {
    const credential = new DefaultAzureCredential();
    const getSecretMock = () => { throw Error("error string");}

    const mockSecretClient = new MockSecretClient('foo', credential, { getSecret: getSecretMock });
    const azurePacerTokenSecretGateway = new AzurePacerTokenSecretGateway(mockSecretClient);

    try {
      await azurePacerTokenSecretGateway.getPacerTokenFromSecrets();
    } catch (e) {
      expect(e).toEqual(Error('error string'));
    }

  } );

  test('should throw no pacer token error when getSecret cannot find a matching token ', async () => {
    const credential = new DefaultAzureCredential();
    const pacerTokenName = process.env.PACER_TOKEN_SECRET_NAME;
    const getSecretMock = () => { throw Error(`${pacerTokenName} was not found in this key vault`);}

    const mockSecretClient = new MockSecretClient('foo', credential, { getSecret: getSecretMock });
    const azurePacerTokenSecretGateway = new AzurePacerTokenSecretGateway(mockSecretClient);

    try {
      await azurePacerTokenSecretGateway.getPacerTokenFromSecrets();
    } catch (e) {
      expect(e).toBeInstanceOf(NoPacerToken);
    }
  })
});
