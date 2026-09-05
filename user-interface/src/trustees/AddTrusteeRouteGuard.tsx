import { Navigate } from 'react-router-dom';
import useFeatureFlags, {
  isFlagEnabled,
  RESTRICT_ADDING_TRUSTEES,
} from '@/lib/hooks/UseFeatureFlags';
import useFeatureFlagReadiness from '@/lib/hooks/UseFeatureFlagReadiness';
import TrusteePublicContactForm from './forms/TrusteePublicContactForm';

export function AddTrusteeRouteGuard() {
  const { isReady } = useFeatureFlagReadiness();
  const flags = useFeatureFlags();

  if (!isReady) {
    return <></>;
  }

  if (isFlagEnabled(flags, RESTRICT_ADDING_TRUSTEES)) {
    return <TrusteePublicContactForm action="create" cancelTo="/trustees" />;
  }

  return <Navigate to="/trustees" replace />;
}

export default AddTrusteeRouteGuard;
