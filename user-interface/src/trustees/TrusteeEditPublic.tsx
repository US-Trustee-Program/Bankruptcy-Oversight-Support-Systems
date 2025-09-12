import TrusteeForm from '@/trustees/TrusteeForm';
import { useLocation } from 'react-router-dom';

export default function TrusteeEditPublic() {
  const location = useLocation();
  return (
    <TrusteeForm
      trustee={location.state.trustee}
      cancelTo={location.state.cancelTo}
      contactInformation="public"
    ></TrusteeForm>
  );
}
