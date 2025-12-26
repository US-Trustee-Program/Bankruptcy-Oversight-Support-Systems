import { useContext, useEffect, useRef } from 'react';
import SessionTimeoutWarningModal, {
  SessionTimeoutWarningModalRef,
} from '../SessionTimeoutWarningModal/SessionTimeoutWarningModal';
import {
  resetLastInteraction,
  logout,
} from '@/login/inactive-logout';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { AUTH_EXPIRY_WARNING, renewOktaToken } from '@/login/providers/okta/okta-library';
import { AuthContext } from '@/login/AuthContext';

export default function SessionTimeoutManager() {
  const sessionTimeoutModalRef = useRef<SessionTimeoutWarningModalRef>(null);
  const globalAlertRef = useGlobalAlert();
  const authContext = useContext(AuthContext);

  // Listen for session timeout warning event
  useEffect(() => {
    const handleSessionTimeoutWarning = () => {
      sessionTimeoutModalRef.current?.show();
    };

    window.addEventListener(AUTH_EXPIRY_WARNING, handleSessionTimeoutWarning);

    return () => {
      window.removeEventListener(AUTH_EXPIRY_WARNING, handleSessionTimeoutWarning);
    };
  }, []);

  const handleStayLoggedIn = () => {
    // Reset client-side timer
    resetLastInteraction();

    // Extend server-side session
    if (authContext.oktaAuth) {
      renewOktaToken(authContext.oktaAuth);
    }

    // Show success message (modal closes automatically via closeOnClick: true)
    globalAlertRef?.success('Your session has been extended');
  };

  return (
    <SessionTimeoutWarningModal
      ref={sessionTimeoutModalRef}
      warningSeconds={60}
      onStayLoggedIn={handleStayLoggedIn}
      onLogoutNow={logout}
    />
  );
}
