import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType, OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import Api2 from '@/lib/models/api2';
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

type CallbackFunction = () => void;

type RemovalState = {
  trusteeId: string;
  assistantId: string;
  callback: CallbackFunction;
} | null;

export type TrusteeAssistantRemovalModalOpenProps = {
  trusteeId: string;
  assistantId: string;
  buttonId: string;
  callback: CallbackFunction;
  openModalButtonRef: React.Ref<OpenModalButtonRef>;
};

export interface TrusteeAssistantRemovalModalRef extends Omit<ModalRefType, 'show'> {
  show: (showProps: TrusteeAssistantRemovalModalOpenProps) => void;
}

interface TrusteeAssistantRemovalModalProps {
  modalId: string;
}

function TrusteeAssistantRemovalModal_(
  props: TrusteeAssistantRemovalModalProps,
  ref: React.Ref<TrusteeAssistantRemovalModalRef>,
) {
  const { modalId } = props;
  const [removalState, setRemovalState] = useState<RemovalState>(null);
  const modalRef = useRef<ModalRefType>(null);
  const globalAlert = useGlobalAlert();

  function handleClickDelete() {
    const state = removalState;
    if (!state || !state.assistantId) return;

    Api2.deleteTrusteeAssistant(state.trusteeId, state.assistantId)
      .then(() => {
        state.callback();
        modalRef.current?.hide();
      })
      .catch(() => {
        globalAlert?.error('There was a problem removing the trustee assistant.');
      });
  }

  function show(showProps: TrusteeAssistantRemovalModalOpenProps) {
    setRemovalState({
      trusteeId: showProps.trusteeId,
      assistantId: showProps.assistantId,
      callback: showProps.callback,
    });

    modalRef.current?.show({
      openModalButtonRef: showProps.openModalButtonRef,
    });
  }

  useImperativeHandle(ref, () => ({
    show,
    hide: () => {
      modalRef.current?.hide();
    },
  }));

  const removeConfirmationButtonGroup: SubmitCancelBtnProps = {
    modalId,
    modalRef,
    submitButton: {
      label: 'Yes, Delete',
      uswdsStyle: UswdsButtonStyle.Secondary,
      onClick: handleClickDelete,
      disabled: !removalState,
      closeOnClick: false,
    },
    cancelButton: {
      label: 'Cancel',
    },
  };

  return (
    <Modal
      ref={modalRef}
      modalId={modalId}
      className="remove-assistant-confirmation-modal"
      heading="Are you sure you want to delete this assistant?"
      content="This action can't be undone."
      actionButtonGroup={removeConfirmationButtonGroup}
    ></Modal>
  );
}

const TrusteeAssistantRemovalModal = forwardRef(TrusteeAssistantRemovalModal_);
export default TrusteeAssistantRemovalModal;
