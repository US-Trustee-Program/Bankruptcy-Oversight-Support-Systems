import { PacerSecretsGateway } from './pacer-secrets.gateway';
import { NoPacerToken } from './pacer-exceptions';
import { AzureKeyVaultGateway } from './azure-key-vault.gateway';
import { ApplicationContext } from '../types/basic';
const context = require('../../testing/default-context');

class MockSecretsGateway extends AzureKeyVaultGateway {
  constructor(functions?: { setSecret?: any; getSecret?: any }) {
    super();
    if (functions?.setSecret) {
      this.setSecret = functions.setSecret;
    }
    if (functions?.getSecret) {
      this.getSecret = functions.getSecret;
    }
  }

  async setSecret(): Promise<string> {
    return Promise.resolve('fake-new-token');
  }

  async getSecret(context: ApplicationContext, name: string): Promise<string> {
    return Promise.resolve('fake-token');
  }
}

describe('Azure PACER secrets gateway test', () => {
  beforeAll(() => {
    process.env = {
      PACER_TOKEN_SECRET_NAME: 'fake-secret',
    };
  });

  test('should throw error', async () => {
    const gateway = new PacerSecretsGateway(
      new MockSecretsGateway({
        setSecret: async () => {
          throw new Error('some error');
        },
      }),
    );

    try {
      await gateway.savePacerTokenToSecrets(context, 'fake-new-token');
      // The following expect should not be reached, but exists to trigger a failure if it is reached
      expect(true).toBeFalsy();
    } catch (e) {
      expect(e.message).toEqual('some error');
    }
  });

  test('should return PACER token', async () => {
    const gateway = new PacerSecretsGateway(new MockSecretsGateway());

    const token = await gateway.getPacerTokenFromSecrets(context);
    expect(token).toEqual('fake-token');
  });

  test('should throw NoPacerToken error', async () => {
    const gateway = new PacerSecretsGateway(
      new MockSecretsGateway({
        getSecret: async () => {
          throw new Error(`The secret fake-secret was not found.`);
        },
      }),
    );

    try {
      await gateway.getPacerTokenFromSecrets(context);
      // The following expect should not be reached, but exists to trigger a failure if it is reached
      expect(true).toBeFalsy();
    } catch (e) {
      expect(e).toBeInstanceOf(NoPacerToken);
    }
  });

  test('should throw error', async () => {
    const gateway = new PacerSecretsGateway(
      new MockSecretsGateway({
        getSecret: async () => {
          throw new Error(`Some unknown error.`);
        },
      }),
    );

    try {
      await gateway.getPacerTokenFromSecrets(context);
      // The following expect should not be reached, but exists to trigger a failure if it is reached
      expect(true).toBeFalsy();
    } catch (e) {
      expect(e).not.toBeInstanceOf(NoPacerToken);
      const comparison = new NoPacerToken();
      expect(e.message).not.toEqual(comparison.message);
    }
  });
});
