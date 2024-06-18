import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Button from '@/lib/components/uswds/Button';
import { LocalStorage } from '@/lib/utils/local-storage';
import { LOGIN_PATH, LOGOUT_SESSION_END_PATH } from './login-library';
import { BlankPage } from './BlankPage';

export function SessionEnd() {
  const location = useLocation();
  const navigate = useNavigate();

  function handleLoginRedirect() {
    navigate(LOGIN_PATH);
  }

  LocalStorage.removeSession();
  LocalStorage.removeAck();

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
