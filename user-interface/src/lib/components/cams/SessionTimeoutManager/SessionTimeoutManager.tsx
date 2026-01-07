import { useContext, useEffect, useRef } from 'react';
import SessionTimeoutWarningModal, {
  SessionTimeoutWarningModalRef,
} from '../SessionTimeoutWarningModal/SessionTimeoutWarningModal';
import {
  SESSION_TIMEOUT,
  SIXTY_SECONDS,
  AUTH_EXPIRY_WARNING,
  logout,
  cancelPendingLogout,
} from '@/login/session-timer';
import { GlobalAlertContext } from '@/App';
import { AuthContext } from '@/login/AuthContext';

export default function SessionTimeoutManager() {
  const sessionTimeoutModalRef = useRef<SessionTimeoutWarningModalRef>(null);
  const globalAlertRefObject = useContext(GlobalAlertContext);
  const authContext = useContext(AuthContext);

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

  const handleStayLoggedIn = async () => {
    cancelPendingLogout();
    try {
      await authContext.renewToken();
      globalAlertRefObject?.current?.success('Your session has been extended');
    } catch (error) {
      globalAlertRefObject?.current?.error('Failed to renew session. Please log in again.');
      console.error('Token renewal failed:', error);
    }
  };

  return (
    <SessionTimeoutWarningModal
      ref={sessionTimeoutModalRef}
      warningSeconds={SIXTY_SECONDS}
      onStayLoggedIn={handleStayLoggedIn}
      onLogoutNow={logout}
    />
  );
}
