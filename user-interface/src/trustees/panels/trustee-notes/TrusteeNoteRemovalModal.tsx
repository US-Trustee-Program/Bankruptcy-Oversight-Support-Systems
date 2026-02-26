import Modal from '@/lib/components/uswds/modal/Modal';
import {
  ModalRefType,
  OpenModalButtonRef,
  SubmitCancelButtonGroupRef,
} from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import Api2 from '@/lib/models/api2';
import LocalStorage from '@/lib/utils/local-storage';
import { getCamsUserReference } from '@common/cams/session';
import { CamsUser } from '@common/cams/users';
import React, { forwardRef, RefObject, useImperativeHandle, useRef, useState } from 'react';

type CallbackFunction = (noteId?: string) => void;

export type TrusteeNoteRemovalModalOpenProps = {
  id: string;
  trusteeId: string;
  buttonId: string;
  callback: CallbackFunction;
  openModalButtonRef: React.Ref<OpenModalButtonRef>;
};

export interface TrusteeNoteRemovalModalRef extends ModalRefType {
  show: (showProps: TrusteeNoteRemovalModalOpenProps) => void;
  buttons?: RefObject<SubmitCancelButtonGroupRef | null>;
}

interface TrusteeNoteRemovalProps {
  modalId: string;
}

function TrusteeNoteRemovalModal_(
  props: TrusteeNoteRemovalProps,
  ref: React.Ref<TrusteeNoteRemovalModalRef>,
) {
  const { modalId } = props;
  const api = Api2;
  const session = LocalStorage.getSession();
  const [formValuesFromShowOptions, setFormValuesFromShowOptions] =
    useState<TrusteeNoteRemovalModalOpenProps | null>(null);
  const modalRef = useRef<ModalRefType>(null);
  const globalAlert = useGlobalAlert();
  const removeConfirmationButtonGroup: SubmitCancelBtnProps = {
    modalId,
    modalRef,
    submitButton: {
      label: 'Delete',
      onClick: handleRemoveSubmitButtonClick,
      disabled: false,
      closeOnClick: true,
    },
    cancelButton: {
      label: 'Cancel',
    },
  };

  function handleRemoveSubmitButtonClick() {
    if (formValuesFromShowOptions?.id) {
      const noteForRemoval = {
        id: formValuesFromShowOptions.id,
        trusteeId: formValuesFromShowOptions.trusteeId,
        updatedBy: getCamsUserReference(session?.user as CamsUser),
      };

      api
        .deleteTrusteeNote(noteForRemoval)
        .then(() => {
          formValuesFromShowOptions.callback();
        })
        .catch(() => {
          globalAlert?.error('There was a problem removing the trustee note.');
        });
    }
  }

  function show(showProps: TrusteeNoteRemovalModalOpenProps) {
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
      className="remove-note-confirmation-modal"
      heading="Delete note?"
      content="Would you like to delete this note? This action cannot be undone."
      actionButtonGroup={removeConfirmationButtonGroup}
    ></Modal>
  );
}

const TrusteeNoteRemovalModal = forwardRef(TrusteeNoteRemovalModal_);
export default TrusteeNoteRemovalModal;
