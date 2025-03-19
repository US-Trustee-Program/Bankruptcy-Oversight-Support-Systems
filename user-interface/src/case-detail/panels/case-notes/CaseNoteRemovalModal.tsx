import Alert, { AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType, OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import Api2 from '@/lib/models/api2';
import LocalStorage from '@/lib/utils/local-storage';
import { getCamsUserReference } from '@common/cams/session';
import { CamsUser } from '@common/cams/users';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

type CallbackFunction = (noteId?: string) => void;

export type CaseNoteRemovalModalOpenProps = {
  id: string;
  caseId: string;
  buttonId: string;
  callback: CallbackFunction;
  openModalButtonRef: OpenModalButtonRef;
};

export interface CaseNoteRemovalModalRef extends ModalRefType {
  show: (showProps: CaseNoteRemovalModalOpenProps) => void;
  hide: () => void;
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

  const alertRef = useRef<AlertRefType>(null);
  const modalRef = useRef<ModalRefType>(null);

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
          alertRef.current?.show();
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

  function hide() {
    if (modalRef.current?.hide) {
      modalRef.current?.hide({});
    }
    setFormValuesFromShowOptions(null);
  }

  useImperativeHandle(ref, () => {
    return {
      show,
      hide,
    };
  });

  return (
    <Modal
      ref={modalRef}
      modalId={modalId}
      className="remove-note-confirmation-modal"
      heading="Remove note?"
      content={
        <>
          <Alert
            id="case-note-removal-error"
            message="There was a problem archiving the note."
            type={UswdsAlertStyle.Error}
            role={'alert'}
            ref={alertRef}
            timeout={0}
            slim={true}
            inline={true}
          />
          <span>Would you like to remove this note? This action cannot be undone.</span>
        </>
      }
      actionButtonGroup={removeConfirmationButtonGroup}
    ></Modal>
  );
}

const CaseNoteRemovalModal = forwardRef(_CaseNoteRemovalModal);

export default CaseNoteRemovalModal;
