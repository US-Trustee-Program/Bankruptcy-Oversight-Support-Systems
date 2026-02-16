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
  const [timerKey, setTimerKey] = useState(0);
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
      setTimerKey((prev) => prev + 1);
      modalRef.current?.show({});
    },
    hide: () => {
      modalRef.current?.hide();
    },
  }));

  return (
    <Modal
      ref={modalRef}
      modalId={modalId}
      heading="You Will Be Logged Out Soon"
      content={
        <p>
          You will be logged out in{' '}
          {timerKey > 0 && <CountdownTimer key={timerKey} timeInMs={warningSeconds * 1000} />}{' '}
          seconds due to inactivity.
        </p>
      }
      forceAction={true}
      actionButtonGroup={actionButtonGroup}
    />
  );
}

const SessionTimeoutWarningModal = forwardRef(SessionTimeoutWarningModal_);
export default SessionTimeoutWarningModal;
