import * as ld from '@launchdarkly/node-server-sdk';
import { ApplicationConfiguration } from '../../configs/application-configuration';
import {
  ANONYMOUS_FEATURE_FLAG_CONTEXT,
  buildLaunchDarklyContext,
  testFeatureFlags,
} from '@common/feature-flags';
import { CamsUser } from '@common/cams/users';
import { FeatureFlagSet } from '../types/basic';

/**
 * The flags used when no LaunchDarkly key is configured. cams-role-assignments stays off: with it
 * on, sessions take roles only from role assignments, and an environment without LaunchDarkly
 * usually has none, so every user would sign in with no roles or offices.
 */
export const flagsWithoutLaunchDarkly: FeatureFlagSet = {
  ...testFeatureFlags,
  'cams-role-assignments': false,
};

export async function getFeatureFlags(
  config: ApplicationConfiguration,
  user?: CamsUser,
): Promise<FeatureFlagSet> {
  if (!config.featureFlagKey) return flagsWithoutLaunchDarkly;

  const client = ld.init(config.featureFlagKey, {
    baseUri: 'https://clientsdk.launchdarkly.us',
    streamUri: 'https://clientstream.launchdarkly.us',
    eventsUri: 'https://events.launchdarkly.us',
  });
  await client.waitForInitialization();
  const context = user ? buildLaunchDarklyContext(user) : ANONYMOUS_FEATURE_FLAG_CONTEXT;
  const state = await client.allFlagsState(context);
  await client.flush();
  client.close();
  return state.allValues();
}

const FeatureFlagsBackend = {
  getFeatureFlags,
};

export default FeatureFlagsBackend;
