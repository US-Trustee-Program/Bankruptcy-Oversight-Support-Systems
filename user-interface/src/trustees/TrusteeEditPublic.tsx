import TrusteeCreateForm from '@/trustees/TrusteeCreateForm';
import { useLocation } from 'react-router-dom';

export default function TrusteeEditPublic() {
  const location = useLocation();
  return (
    <TrusteeCreateForm
      trustee={location.state.trustee}
      cancelTo={location.state.cancelTo}
      contactInformation="public"
    ></TrusteeCreateForm>
  );
}
