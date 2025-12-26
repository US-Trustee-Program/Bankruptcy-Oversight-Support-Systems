import { forwardRef, useImperativeHandle, useRef } from 'react';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';

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

  useImperativeHandle(ref, () => ({
    show: () => {
      modalRef.current?.show({});
    },
    hide: () => {
      modalRef.current?.hide({});
    },
  }));

  return (
    <Modal
      ref={modalRef}
      modalId={modalId}
      heading="Session Expiring Soon"
      content={
        <p>
          Your session will expire in {warningSeconds} seconds due to inactivity. Click &quot;Stay
          Logged In&quot; to continue working, or &quot;Log Out Now&quot; to end your session.
        </p>
      }
      forceAction={true}
      actionButtonGroup={actionButtonGroup}
    />
  );
}

const SessionTimeoutWarningModal = forwardRef(SessionTimeoutWarningModal_);
export default SessionTimeoutWarningModal;
