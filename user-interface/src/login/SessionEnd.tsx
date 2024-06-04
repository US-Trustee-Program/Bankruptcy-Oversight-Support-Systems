import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { BlankPage } from './BlankPage';
import { LOGIN_LOCAL_STORAGE_ACK_KEY, LOGIN_LOCAL_STORAGE_SESSION_KEY } from './login-helpers';

export function SessionEnd() {
  if (window.localStorage) {
    window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_SESSION_KEY);
    window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_ACK_KEY);
  }
  return (
    <BlankPage>
      <Alert
        show={true}
        inline={true}
        type={UswdsAlertStyle.Info}
        title="Logout"
        message="You are now logged out of the application."
      ></Alert>
      <a href="/login">Login</a>
    </BlankPage>
  );
}
