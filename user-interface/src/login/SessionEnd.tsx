import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { BlankPage } from './BlankPage';
import {
  LOGIN_LOCAL_STORAGE_ACK_KEY,
  LOGIN_LOCAL_STORAGE_SESSION_KEY,
  LOGIN_PATH,
  LOGOUT_SESSION_END_PATH,
} from './login-library';
import Button from '@/lib/components/uswds/Button';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export function SessionEnd() {
  const location = useLocation();
  const navigate = useNavigate();

  function handleLoginRedirect() {
    navigate(LOGIN_PATH);
  }

  if (window.localStorage) {
    window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_SESSION_KEY);
    window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_ACK_KEY);
  }

  useEffect(() => {
    if (location.pathname !== LOGOUT_SESSION_END_PATH) {
      navigate(LOGOUT_SESSION_END_PATH);
    }
  }, []);

  return (
    <BlankPage>
      <Alert
        className="measure-6"
        show={true}
        inline={true}
        type={UswdsAlertStyle.Info}
        title="Session End"
        message="You are now logged out of the application."
      ></Alert>
      <div>
        <Button id="login" onClick={handleLoginRedirect}>
          Login
        </Button>
      </div>
    </BlankPage>
  );
}
