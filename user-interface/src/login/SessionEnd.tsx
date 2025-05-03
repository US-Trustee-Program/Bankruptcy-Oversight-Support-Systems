import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Button from '@/lib/components/uswds/Button';
import useCamsNavigator from '@/lib/hooks/UseCamsNavigator';
import { API_CACHE_NAMESPACE } from '@/lib/models/api2';
import LocalCache from '@/lib/utils/local-cache';
import { LocalStorage } from '@/lib/utils/local-storage';
import { broadcastLogout } from '@/login/broadcast-logout';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { BlankPage } from './BlankPage';
import { LOGIN_PATH, LOGOUT_SESSION_END_PATH } from './login-library';

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
        inline={true}
        message="You are now logged out of the application."
        show={true}
        title="Session End"
        type={UswdsAlertStyle.Info}
      ></Alert>
      <div>
        <Button id="login" onClick={handleLoginRedirect}>
          Login
        </Button>
      </div>
    </BlankPage>
  );
}
