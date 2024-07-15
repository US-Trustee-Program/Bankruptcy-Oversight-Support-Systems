import { isCamsApi } from '@/configuration/apiConfiguration';
import { useNavigate } from 'react-router-dom';

export async function http401Hook(response: Response) {
  if (response.status === 401 && isCamsApi(response.url)) {
    const navigate = useNavigate();
    navigate('/logout');
  }
}
