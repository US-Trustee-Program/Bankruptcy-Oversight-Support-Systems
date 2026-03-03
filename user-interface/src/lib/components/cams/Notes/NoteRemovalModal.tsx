import Modal from '@/lib/components/uswds/modal/Modal';
import {
  ModalRefType,
  OpenModalButtonRef,
  SubmitCancelButtonGroupRef,
} from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import React, { forwardRef, RefObject, useImperativeHandle, useRef, useState } from 'react';

export type NoteRemovalModalOpenProps = {
  id: string;
  buttonId: string;
  openModalButtonRef: React.Ref<OpenModalButtonRef>;
};

export interface NoteRemovalModalRef extends ModalRefType {
  show: (showProps: NoteRemovalModalOpenProps) => void;
  buttons?: RefObject<SubmitCancelButtonGroupRef | null>;
}

interface NoteRemovalModalProps {
  modalId: string;
  onDelete: (noteId: string) => Promise<void>;
}

function NoteRemovalModal_(props: NoteRemovalModalProps, ref: React.Ref<NoteRemovalModalRef>) {
  const { modalId } = props;
  const [formValuesFromShowOptions, setFormValuesFromShowOptions] =
    useState<NoteRemovalModalOpenProps | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const modalRef = useRef<ModalRefType>(null);

  async function handleRemoveSubmitButtonClick() {
    if (formValuesFromShowOptions?.id && !isDeleting) {
      setIsDeleting(true);
      try {
        await props.onDelete(formValuesFromShowOptions.id);
        modalRef.current?.hide();
      } catch (error) {
        console.error('Error deleting note:', error);
      } finally {
        setIsDeleting(false);
      }
    }
  }

  const removeConfirmationButtonGroup: SubmitCancelBtnProps = {
    modalId,
    modalRef,
    submitButton: {
      label: 'Delete',
      onClick: handleRemoveSubmitButtonClick,
      disabled: isDeleting,
      closeOnClick: false,
    },
    cancelButton: {
      label: 'Cancel',
    },
  };

  function show(showProps: NoteRemovalModalOpenProps) {
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

const NoteRemovalModal = forwardRef(NoteRemovalModal_);
export default NoteRemovalModal;
