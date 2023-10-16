import * as ld from '@launchdarkly/node-server-sdk';
import { ApplicationConfiguration } from '../../configs/application-configuration';

export async function getFeatureFlags(config: ApplicationConfiguration) {
  if (!config.featureFlagKey) {
    return {};
  }
  const client = ld.init(config.featureFlagKey, {
    baseUri: 'https://clientsdk.launchdarkly.us',
    streamUri: 'https://clientstream.launchdarkly.us',
    eventsUri: 'https://events.launchdarkly.us',
  });
  await client.waitForInitialization();
  const state = await client.allFlagsState({
    kind: 'user',
    key: 'feature-flag-poc',
    anonymous: true,
  });
  await client.flush();
  client.close();
  return state.allValues();
}
