import Modal from '@/lib/components/uswds/modal/Modal';
import {
  ModalRefType,
  OpenModalButtonRef,
  SubmitCancelButtonGroupRef,
} from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import Api2 from '@/lib/models/api2';
import React, { forwardRef, RefObject, useImperativeHandle, useRef, useState } from 'react';

type CallbackFunction = () => void;

export type TrusteeAssistantRemovalModalOpenProps = {
  trusteeId: string;
  assistantId: string;
  buttonId: string;
  callback: CallbackFunction;
  openModalButtonRef: React.Ref<OpenModalButtonRef>;
};

export interface TrusteeAssistantRemovalModalRef extends ModalRefType {
  show: (showProps: TrusteeAssistantRemovalModalOpenProps) => void;
  buttons?: RefObject<SubmitCancelButtonGroupRef | null>;
}

interface TrusteeAssistantRemovalModalProps {
  modalId: string;
}

function TrusteeAssistantRemovalModal_(
  props: TrusteeAssistantRemovalModalProps,
  ref: React.Ref<TrusteeAssistantRemovalModalRef>,
) {
  const { modalId } = props;
  const [formValuesFromShowOptions, setFormValuesFromShowOptions] =
    useState<TrusteeAssistantRemovalModalOpenProps | null>(null);
  const modalRef = useRef<ModalRefType>(null);
  const globalAlert = useGlobalAlert();

  const removeConfirmationButtonGroup: SubmitCancelBtnProps = {
    modalId,
    modalRef,
    submitButton: {
      label: 'Yes, Delete',
      uswdsStyle: UswdsButtonStyle.Secondary,
      onClick: handleRemoveSubmitButtonClick,
      disabled: false,
      closeOnClick: true,
    },
    cancelButton: {
      label: 'Cancel',
    },
  };

  function handleRemoveSubmitButtonClick() {
    if (formValuesFromShowOptions?.assistantId) {
      Api2.deleteTrusteeAssistant(
        formValuesFromShowOptions.trusteeId,
        formValuesFromShowOptions.assistantId,
      )
        .then(() => {
          formValuesFromShowOptions.callback();
        })
        .catch(() => {
          globalAlert?.error('There was a problem removing the trustee assistant.');
        });
    }
  }

  function show(showProps: TrusteeAssistantRemovalModalOpenProps) {
    setFormValuesFromShowOptions(showProps);

    if (modalRef.current?.show) {
      const showOptions = {
        openModalButtonRef: showProps.openModalButtonRef,
      };
      modalRef.current?.show(showOptions);
    }
  }

  useImperativeHandle(ref, () => ({
    show,
    hide: () => {},
  }));

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
