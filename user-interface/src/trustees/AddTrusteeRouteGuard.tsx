import { Navigate } from 'react-router-dom';
import useFeatureFlags, {
  isFlagEnabled,
  RESTRICT_ADDING_TRUSTEES,
} from '@/lib/hooks/UseFeatureFlags';
import useFeatureFlagReadiness from '@/lib/hooks/UseFeatureFlagReadiness';
import TrusteePublicContactForm from './forms/TrusteePublicContactForm';

export function AddTrusteeRouteGuard() {
  const { isReady, hasTimedOut } = useFeatureFlagReadiness();
  const flags = useFeatureFlags();

  if (!isReady) {
    return <></>;
  }

  // isReady only means the LaunchDarkly client finished initializing, not that this
  // specific flag's value has arrived yet. Wait for the flag to actually populate (or
  // for the grace-period timeout) before acting, to avoid misreading an unpopulated flag
  // as false and wrongly redirecting an authorized user.
  const hasFlagValue = RESTRICT_ADDING_TRUSTEES in flags;
  if (!hasFlagValue && !hasTimedOut) {
    return <></>;
  }

  if (isFlagEnabled(flags, RESTRICT_ADDING_TRUSTEES)) {
    return <TrusteePublicContactForm action="create" cancelTo="/trustees" />;
  }

  return <Navigate to="/trustees" replace />;
}

export default AddTrusteeRouteGuard;
