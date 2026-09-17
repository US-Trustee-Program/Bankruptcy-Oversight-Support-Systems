import { Navigate } from 'react-router-dom';
import useFeatureFlags, {
  canAddTrustee,
  RESTRICT_ADDING_TRUSTEES,
} from '@/lib/hooks/UseFeatureFlags';
import useFeatureFlagReadiness from '@/lib/hooks/UseFeatureFlagReadiness';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import TrusteePublicContactForm from './forms/TrusteePublicContactForm';

export function AddTrusteeRouteGuard() {
  const { isReady, hasTimedOut, hasIdentified } = useFeatureFlagReadiness();
  const flags = useFeatureFlags();

  if (!isReady) {
    return <LoadingSpinner caption="Checking access..." />;
  }

  // isReady only means the LaunchDarkly client finished initializing its initial, anonymous
  // context -- not that this flag has been re-evaluated for the identified (logged-in) user yet,
  // nor that the flag has arrived at all. Waiting on hasFlagValue alone isn't enough: the
  // anonymous context's value can populate before identify() resolves, and that value belongs to
  // the wrong context. Wait for BOTH identify() to complete AND the flag to populate (or the
  // grace-period timeout, as a safety valve if either never resolves) before acting -- otherwise
  // an authorized user's flag read could reflect the anonymous context and redirect them away
  // from a route they're allowed to reach.
  const hasFlagValue = RESTRICT_ADDING_TRUSTEES in flags;
  const readyToDecide = hasTimedOut || (hasIdentified && hasFlagValue);
  if (!readyToDecide) {
    return <LoadingSpinner caption="Checking access..." />;
  }

  if (canAddTrustee(flags)) {
    return <TrusteePublicContactForm action="create" cancelTo="/trustees" />;
  }

  return <Navigate to="/trustees" replace />;
}
