import { useEffect, useRef } from 'react';
import SessionTimeoutWarningModal, {
  SessionTimeoutWarningModalRef,
} from '../SessionTimeoutWarningModal/SessionTimeoutWarningModal';
import {
  SESSION_TIMEOUT_WARNING_EVENT,
  resetLastInteraction,
  logout,
} from '@/login/inactive-logout';
import Api2 from '@/lib/models/api2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';

export default function SessionTimeoutManager() {
  const sessionTimeoutModalRef = useRef<SessionTimeoutWarningModalRef>(null);
  const globalAlertRef = useGlobalAlert();

  // Listen for session timeout warning event
  useEffect(() => {
    const handleSessionTimeoutWarning = () => {
      sessionTimeoutModalRef.current?.show();
    };

    window.addEventListener(SESSION_TIMEOUT_WARNING_EVENT, handleSessionTimeoutWarning);

    return () => {
      window.removeEventListener(SESSION_TIMEOUT_WARNING_EVENT, handleSessionTimeoutWarning);
    };
  }, []);

  const handleStayLoggedIn = () => {
    // Reset client-side timer
    resetLastInteraction();

    // Attempt to extend server-side session
    Api2.extendSession().catch((error: unknown) => {
      console.warn('Session extension API call failed:', error);
      // Client timer still reset, user continues working
    });

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
