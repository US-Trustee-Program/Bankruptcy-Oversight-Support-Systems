import {
  GetSecretOptions,
  KeyVaultSecret,
  SecretClient,
  SecretProperties,
  SetSecretOptions
} from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';
import { AzureKeyVaultGateway } from './azure-key-vault.gateway';
const context = require('../../testing/defaultContext');

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
describe('Azure Key Vault Gateway tests', () => {
  test('should return the secret name when it exists', async () => {
    const credential = new DefaultAzureCredential();
    const mockSecretClient = new MockSecretClient('foo', credential);
    const azureKeyVaultGateway = new AzureKeyVaultGateway(mockSecretClient);

    const setSecretSpy = jest.spyOn(mockSecretClient, 'setSecret');
    const savedSecretName = await azureKeyVaultGateway.setSecret('fake-secret', 'fake-value', context);

    expect(setSecretSpy).toHaveBeenCalled();
    expect(savedSecretName).toBe('fake-secret');
  });

  test('should throw error when setSecret returns secret name that does not match', async () => {
    const credential = new DefaultAzureCredential();
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
    const azureKeyVaultGateway = new AzureKeyVaultGateway(mockSecretClient);

    try {
      await azureKeyVaultGateway.setSecret('fake-secret', 'fake-value', context);
    } catch (e) {
      expect(e).toEqual(Error(`New KeyVault token 'fake-secret' was not saved.`));
    }
  });

  test('should throw error when setSecret gets an error', async () => {
    const credential = new DefaultAzureCredential();
    const setSecretMock = () => { throw Error('error string'); }
    const mockSecretClient = new MockSecretClient('foo', credential, { setSecret: setSecretMock });

    const azureKeyVaultGateway = new AzureKeyVaultGateway(mockSecretClient);

    await azureKeyVaultGateway.setSecret('fake-secret', 'fake-value', context).catch(reason => {
      expect(reason).toEqual(Error('error string'));
    });
  });
});
