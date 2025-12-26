import { useContext, useEffect, useRef } from 'react';
import SessionTimeoutWarningModal, {
  SessionTimeoutWarningModalRef,
} from '../SessionTimeoutWarningModal/SessionTimeoutWarningModal';
import { resetLastInteraction, logout } from '@/login/inactive-logout';
import { GlobalAlertContext } from '@/App';
import { AUTH_EXPIRY_WARNING, renewOktaToken } from '@/login/providers/okta/okta-library';
import { AuthContext } from '@/login/AuthContext';

export default function SessionTimeoutManager() {
  const sessionTimeoutModalRef = useRef<SessionTimeoutWarningModalRef>(null);
  const globalAlertRefObject = useContext(GlobalAlertContext);
  const authContext = useContext(AuthContext);

  useEffect(() => {
    const handleSessionTimeoutWarning = () => {
      sessionTimeoutModalRef.current?.show();
    };

    window.addEventListener(AUTH_EXPIRY_WARNING, handleSessionTimeoutWarning);
    // add event listener for SESSION_TIMEOUT_WARNING_EVENT

    return () => {
      window.removeEventListener(AUTH_EXPIRY_WARNING, handleSessionTimeoutWarning);
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
      warningSeconds={60}
      onStayLoggedIn={handleStayLoggedIn}
      onLogoutNow={logout}
    />
  );
}
