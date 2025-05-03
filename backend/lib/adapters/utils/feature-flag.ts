import * as ld from '@launchdarkly/node-server-sdk';

import { testFeatureFlags } from '../../../../common/src/feature-flags';
import { ApplicationConfiguration } from '../../configs/application-configuration';
import { FeatureFlagSet } from '../types/basic';

export async function getFeatureFlags(config: ApplicationConfiguration): Promise<FeatureFlagSet> {
  if (!config.featureFlagKey) return testFeatureFlags;

  const client = ld.init(config.featureFlagKey, {
    baseUri: 'https://clientsdk.launchdarkly.us',
    eventsUri: 'https://events.launchdarkly.us',
    streamUri: 'https://clientstream.launchdarkly.us',
  });
  await client.waitForInitialization();
  const state = await client.allFlagsState({
    anonymous: true,
    key: 'feature-flag-migration',
    kind: 'user',
  });
  await client.flush();
  client.close();
  return state.allValues();
}

const FeatureFlagsBackend = {
  getFeatureFlags,
};

export default FeatureFlagsBackend;
