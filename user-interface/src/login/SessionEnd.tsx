import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Button from '@/lib/components/uswds/Button';
import LocalStorage from '@/lib/utils/local-storage';
import { LOGIN_PATH, LOGOUT_SESSION_END_PATH } from './login-library';
import { BlankPage } from './BlankPage';
import { broadcastLogout } from '@/login/broadcast-logout';
import useCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import LocalCache from '@/lib/utils/local-cache';
import { API_CACHE_NAMESPACE } from '@/lib/models/api2';

export function SessionEnd() {
  const location = useLocation();

  const navigator = useCamsNavigator();
  function handleLoginRedirect() {
    navigator.navigateTo(LOGIN_PATH);
  }

  useEffect(() => {
    LocalStorage.removeSession();
    LocalStorage.removeAck();
    LocalCache.removeNamespace(API_CACHE_NAMESPACE);

    broadcastLogout();
    if (location.pathname !== LOGOUT_SESSION_END_PATH) {
      navigator.navigateTo(LOGOUT_SESSION_END_PATH);
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
