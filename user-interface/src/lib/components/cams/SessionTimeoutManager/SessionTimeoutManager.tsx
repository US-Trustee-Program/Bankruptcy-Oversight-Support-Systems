import { useContext, useEffect, useRef } from 'react';
import SessionTimeoutWarningModal, {
  SessionTimeoutWarningModalRef,
} from '../SessionTimeoutWarningModal/SessionTimeoutWarningModal';
import {
  SessionTimerController,
  SESSION_TIMEOUT,
  SIXTY_SECONDS,
} from '@/login/session-timer-controller';
import { GlobalAlertContext } from '@/App';
import { AUTH_EXPIRY_WARNING, renewOktaToken } from '@/login/providers/okta/okta-library';
import { AuthContext } from '@/login/AuthContext';

export default function SessionTimeoutManager() {
  const sessionTimeoutModalRef = useRef<SessionTimeoutWarningModalRef>(null);
  const globalAlertRefObject = useContext(GlobalAlertContext);
  const authContext = useContext(AuthContext);
  const sessionTimerController = new SessionTimerController();

  useEffect(() => {
    const handleAuthExpiryWarning = () => {
      sessionTimeoutModalRef.current?.show();
    };

    const handleSessionTimeout = () => {
      sessionTimerController.logout();
    };

    window.addEventListener(AUTH_EXPIRY_WARNING, handleAuthExpiryWarning);
    window.addEventListener(SESSION_TIMEOUT, handleSessionTimeout);

    return () => {
      window.removeEventListener(AUTH_EXPIRY_WARNING, handleAuthExpiryWarning);
      window.removeEventListener(SESSION_TIMEOUT, handleSessionTimeout);
    };
  }, []);

  const handleStayLoggedIn = () => {
    sessionTimerController.resetLastInteraction();

    if (authContext.oktaAuth) {
      renewOktaToken(authContext.oktaAuth);
    }

    globalAlertRefObject?.current?.success('Your session has been extended');
  };

  //const other event handler

  return (
    <SessionTimeoutWarningModal
      ref={sessionTimeoutModalRef}
      warningSeconds={SIXTY_SECONDS}
      onStayLoggedIn={handleStayLoggedIn}
      onLogoutNow={sessionTimerController.logout}
    />
  );
}
