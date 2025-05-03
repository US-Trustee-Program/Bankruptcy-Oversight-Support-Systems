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
import { forwardRef, RefObject, useImperativeHandle, useRef, useState } from 'react';

export type CaseNoteRemovalModalOpenProps = {
  buttonId: string;
  callback: CallbackFunction;
  caseId: string;
  id: string;
  openModalButtonRef: React.Ref<OpenModalButtonRef>;
};

export interface CaseNoteRemovalModalRef extends ModalRefType {
  buttons?: RefObject<SubmitCancelButtonGroupRef>;
  show: (showProps: CaseNoteRemovalModalOpenProps) => void;
}

export interface CaseNoteRemovalProps {
  modalId: string;
}

type CallbackFunction = (noteId?: string) => void;

function _CaseNoteRemovalModal(
  props: CaseNoteRemovalProps,
  ref: React.Ref<CaseNoteRemovalModalRef>,
) {
  const { modalId } = props;
  const api = Api2;
  const session = LocalStorage.getSession();
  const [formValuesFromShowOptions, setFormValuesFromShowOptions] =
    useState<CaseNoteRemovalModalOpenProps | null>(null);
  const modalRef = useRef<ModalRefType>(null);
  const globalAlert = useGlobalAlert();
  const removeConfirmationButtonGroup: SubmitCancelBtnProps = {
    cancelButton: {
      label: 'Cancel',
    },
    modalId,
    modalRef: modalRef as React.RefObject<ModalRefType>,
    submitButton: {
      closeOnClick: true,
      disabled: false,
      label: 'Remove',
      onClick: handleRemoveSubmitButtonClick,
    },
  };

  function handleRemoveSubmitButtonClick() {
    if (formValuesFromShowOptions?.id) {
      const noteForRemoval = {
        caseId: formValuesFromShowOptions.caseId,
        id: formValuesFromShowOptions.id,
        updatedBy: getCamsUserReference(session?.user as CamsUser),
      };

      api
        .deleteCaseNote(noteForRemoval)
        .then(() => {
          formValuesFromShowOptions.callback();
        })
        .catch(() => {
          globalAlert?.error('There was a problem removing the case note.');
        });
    }
  }

  function show(showProps: CaseNoteRemovalModalOpenProps) {
    setFormValuesFromShowOptions(showProps);

    if (modalRef.current?.show) {
      const showOptions = {
        openModalButtonRef: showProps.openModalButtonRef,
      };
      modalRef.current?.show(showOptions);
    }
  }

  useImperativeHandle(ref, () => ({
    hide: () => {},
    show,
  }));

  return (
    <Modal
      actionButtonGroup={removeConfirmationButtonGroup}
      className="remove-note-confirmation-modal"
      content="Would you like to remove this note? This action cannot be undone."
      heading="Remove note?"
      modalId={modalId}
      ref={modalRef}
    ></Modal>
  );
}

const CaseNoteRemovalModal = forwardRef(_CaseNoteRemovalModal);

export default CaseNoteRemovalModal;
