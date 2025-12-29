import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import { CountdownTimer } from './CountdownTimer';

export interface SessionTimeoutWarningModalRef {
  show: () => void;
  hide: () => void;
}

interface SessionTimeoutWarningModalProps {
  warningSeconds: number;
  onStayLoggedIn: () => void;
  onLogoutNow: () => void;
}

function SessionTimeoutWarningModal_(
  props: SessionTimeoutWarningModalProps,
  ref: React.Ref<SessionTimeoutWarningModalRef>,
) {
  const modalRef = useRef<ModalRefType>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [mountKey, setMountKey] = useState(0);
  const { warningSeconds, onStayLoggedIn, onLogoutNow } = props;
  const modalId = 'session-timeout-warning';

  const actionButtonGroup: SubmitCancelBtnProps = {
    modalId,
    modalRef,
    submitButton: {
      label: 'Stay Logged In',
      onClick: onStayLoggedIn,
      closeOnClick: true,
    },
    cancelButton: {
      label: 'Log Out Now',
      onClick: onLogoutNow,
    },
  };

  useImperativeHandle(
    ref,
    () => ({
      show: () => {
        // Only remount if modal is not already open
        if (!isOpen) {
          setMountKey((prev) => prev + 1);
        }
        setIsOpen(true);
        modalRef.current?.show({});
      },
      hide: () => {
        setIsOpen(false);
        modalRef.current?.hide({});
      },
    }),
    [isOpen],
  );

  return (
    <Modal
      ref={modalRef}
      modalId={modalId}
      heading="Session Expiring Soon"
      content={
        <p>
          Your session will expire in{' '}
          {isOpen && <CountdownTimer key={mountKey} timeInMs={warningSeconds * 1000} />} seconds due
          to inactivity. Click &quot;Stay Logged In&quot; to continue working, or &quot;Log Out
          Now&quot; to end your session.
        </p>
      }
      forceAction={true}
      actionButtonGroup={actionButtonGroup}
      onClose={() => setIsOpen(false)}
    />
  );
}

const SessionTimeoutWarningModal = forwardRef(SessionTimeoutWarningModal_);
export default SessionTimeoutWarningModal;
