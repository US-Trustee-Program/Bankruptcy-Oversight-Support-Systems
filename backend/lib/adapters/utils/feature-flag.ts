import * as ld from '@launchdarkly/node-server-sdk';
import { ApplicationConfiguration } from '../../configs/application-configuration';
import { defaultFeatureFlags } from '../../../../common/src/feature-flags';
import { FeatureFlagSet } from '../types/basic';

export async function getFeatureFlags(config: ApplicationConfiguration): Promise<FeatureFlagSet> {
  if (!config.featureFlagKey) return defaultFeatureFlags;

  const client = ld.init(config.featureFlagKey, {
    baseUri: 'https://clientsdk.launchdarkly.us',
    streamUri: 'https://clientstream.launchdarkly.us',
    eventsUri: 'https://events.launchdarkly.us',
  });
  await client.waitForInitialization();
  //TODO: revisit if this is necessary when we look at why we need to restart the backend for feature flags
  const state = await client.allFlagsState({
    kind: 'user',
    key: 'feature-flag-migration',
    anonymous: true,
  });
  await client.flush();
  client.close();
  return state.allValues();
}

const FeatureFlagsBackend = {
  getFeatureFlags,
};

export default FeatureFlagsBackend;
