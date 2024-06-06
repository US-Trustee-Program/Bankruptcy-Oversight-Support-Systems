import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { BlankPage } from './BlankPage';
import {
  LOGIN_LOCAL_STORAGE_ACK_KEY,
  LOGIN_LOCAL_STORAGE_SESSION_KEY,
  LOGIN_PATH,
} from './login-helpers';
import Button from '@/lib/components/uswds/Button';
import { useNavigate } from 'react-router-dom';

export function SessionEnd() {
  const navigate = useNavigate();

  function handleLoginRedirect() {
    navigate(LOGIN_PATH);
  }

  if (window.localStorage) {
    window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_SESSION_KEY);
    window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_ACK_KEY);
  }

  return (
    <BlankPage>
      <Alert
        className="measure-6"
        show={true}
        inline={true}
        type={UswdsAlertStyle.Info}
        title="Logout"
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
