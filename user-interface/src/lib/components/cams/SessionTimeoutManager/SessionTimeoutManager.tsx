import { useContext, useEffect, useRef } from 'react';
import SessionTimeoutWarningModal, {
  SessionTimeoutWarningModalRef,
} from '../SessionTimeoutWarningModal/SessionTimeoutWarningModal';
import { resetLastInteraction, logout, SESSION_TIMEOUT } from '@/login/inactive-logout';
import { GlobalAlertContext } from '@/App';
import { AUTH_EXPIRY_WARNING, renewOktaToken } from '@/login/providers/okta/okta-library';
import { AuthContext } from '@/login/AuthContext';

export default function SessionTimeoutManager() {
  const sessionTimeoutModalRef = useRef<SessionTimeoutWarningModalRef>(null);
  const globalAlertRefObject = useContext(GlobalAlertContext);
  const authContext = useContext(AuthContext);

  const ONE_MINUTE = 60;

  useEffect(() => {
    const handleAuthExpiryWarning = () => {
      sessionTimeoutModalRef.current?.show();
    };

    const handleSessionTimeout = () => {
      logout();
    };

    window.addEventListener(AUTH_EXPIRY_WARNING, handleAuthExpiryWarning);
    window.addEventListener(SESSION_TIMEOUT, handleSessionTimeout);

    return () => {
      window.removeEventListener(AUTH_EXPIRY_WARNING, handleAuthExpiryWarning);
      window.removeEventListener(SESSION_TIMEOUT, handleSessionTimeout);
    };
  }, []);

  const handleStayLoggedIn = () => {
    resetLastInteraction();

    if (authContext.oktaAuth) {
      renewOktaToken(authContext.oktaAuth);
    }

    globalAlertRefObject?.current?.success('Your session has been extended');
  };

  //const other event handler

  return (
    <SessionTimeoutWarningModal
      ref={sessionTimeoutModalRef}
      warningSeconds={ONE_MINUTE}
      onStayLoggedIn={handleStayLoggedIn}
      onLogoutNow={logout}
    />
  );
}
