import { LOGOUT_SESSION_END_PATH } from '@/login/login-library';
import { useEffect } from 'react';
import LocalStorage from '../utils/local-storage';
import { useNavigate } from 'react-router-dom';

export default function useSessionCheck() {
  const session = LocalStorage.getSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!session || !session.user.name || session.expires < Math.floor(Date.now() / 1000)) {
      navigate(LOGOUT_SESSION_END_PATH);
    }
  }, [session, navigate]);
}
