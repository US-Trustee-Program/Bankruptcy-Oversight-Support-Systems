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

type CallbackFunction = (noteId?: string) => void;

export type CaseNoteRemovalModalOpenProps = {
  id: string;
  caseId: string;
  buttonId: string;
  callback: CallbackFunction;
  openModalButtonRef: React.Ref<OpenModalButtonRef>;
};

export interface CaseNoteRemovalModalRef extends ModalRefType {
  show: (showProps: CaseNoteRemovalModalOpenProps) => void;
  buttons?: RefObject<SubmitCancelButtonGroupRef>;
}

export interface CaseNoteRemovalProps {
  modalId: string;
}

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
    modalId,
    modalRef: modalRef as React.RefObject<ModalRefType>,
    submitButton: {
      label: 'Remove',
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
        caseId: formValuesFromShowOptions.caseId,
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
    show,
    hide: () => {},
  }));

  return (
    <Modal
      ref={modalRef}
      modalId={modalId}
      className="remove-note-confirmation-modal"
      heading="Remove note?"
      content="Would you like to remove this note? This action cannot be undone."
      actionButtonGroup={removeConfirmationButtonGroup}
    ></Modal>
  );
}

const CaseNoteRemovalModal = forwardRef(_CaseNoteRemovalModal);

export default CaseNoteRemovalModal;
