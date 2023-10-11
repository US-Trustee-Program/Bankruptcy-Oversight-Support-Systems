import { useFlags } from 'launchdarkly-react-client-sdk';
import featureFlags from '../configuration/featureFlagConfiguration';

// TESTING. The useFeatureFlags hook should be able to be mocked in tests to inject
// the desired feature flag to test flag driven logic in the app.

// This internal interface aligns with the LaunchDarkly LDFlagSet interface that
// types the return of the useFlags hook. It is more restrictive than the `any` type
// used for the value which could include JSON / object literal payloads. If we were
// to use JSON feature flag values out of LaunchDarkly then this definition would
// need to be revisited.
interface FeatureFlagSet {
  [key: string]: boolean | string | number;
}

// NOTE: The default below uses the kebab case used in the LaunchDarkly flag configuration.
// This is controlled via the `useCamelCaseFlagKeys` flag in featureFlagConfiguration.ts
// If true then LaunchDarkly converts the kebab cases of the flags in LD to camel case equivalents.
const defaultFeatureFlags: FeatureFlagSet = {
  'feature-flag-poc': true,
};

export default function useFeatureFlags(): FeatureFlagSet {
  if (featureFlags.useExternalProvider) return useFlags();
  return defaultFeatureFlags;
}
