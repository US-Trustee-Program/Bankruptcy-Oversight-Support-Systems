import TrusteeCreateForm from '@/trustees/TrusteeCreateForm';
import { useLocation } from 'react-router-dom';

export default function TrusteeCreate() {
  const location = useLocation();
  return <TrusteeCreateForm cancelTo={location.state.cancelTo}></TrusteeCreateForm>;
}
