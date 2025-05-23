import * as AppConfigModule from '@/configuration/appConfiguration';
import { AppConfiguration } from '@/configuration/appConfiguration';

export const blankConfiguration: AppConfiguration = {
  loginProvider: undefined,
  basePath: undefined,
  serverHostName: undefined,
  serverPort: undefined,
  serverProtocol: undefined,
  featureFlagClientId: undefined,
  launchDarklyEnv: undefined,
  applicationInsightsConnectionString: undefined,
  useFakeApi: false,
  disableLocalCache: false,
  inactiveTimeout: undefined,
  loginProviderConfig: undefined,
};

export function mockConfiguration(override: Partial<typeof blankConfiguration>) {
  return vi.spyOn(AppConfigModule, 'default').mockReturnValue({
    ...blankConfiguration,
    ...override,
  });
}
