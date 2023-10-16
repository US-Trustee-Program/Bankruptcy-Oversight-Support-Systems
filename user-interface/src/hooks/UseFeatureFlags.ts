import { useFlags } from 'launchdarkly-react-client-sdk';
import config from '../configuration/featureFlagConfiguration';

export const CHAPTER_TWELVE_ENABLED = 'chapter-twelve-enabled';

// This internal interface aligns with the LaunchDarkly LDFlagSet interface that
// types the return of the useFlags hook. It is more restrictive than the `any` type
// used for the value which could include JSON / object literal payloads. If we were
// to use JSON feature flag values out of LaunchDarkly then this definition would
// need to be revisited.
interface FeatureFlagSet {
  [key: string]: boolean | string | number;
}

const defaultFeatureFlags: FeatureFlagSet = {
  'chapter-twelve-enabled': false,
};

export default function useFeatureFlags(): FeatureFlagSet {
  if (!config.useExternalProvider) return defaultFeatureFlags;

  const featureFlags = useFlags();
  console.log(featureFlags);
  return !featureFlags || Object.keys(featureFlags).length === 0
    ? defaultFeatureFlags
    : featureFlags;
}
