import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType, OpenModalButtonRef } from '@/lib/components/uswds/modal/modal-refs';
import { SubmitCancelBtnProps } from '@/lib/components/uswds/modal/SubmitCancelButtonGroup';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

export type RemovalModalShowOptions = {
  openModalButtonRef: React.RefObject<OpenModalButtonRef | null>;
  onDelete: () => Promise<void>;
};

export interface RemovalModalRef extends ModalRefType {
  show: (showProps: RemovalModalShowOptions) => void;
}

interface RemovalModalProps {
  modalId: string;
  objectName: string;
}

function RemovalModal_(props: RemovalModalProps, ref: React.Ref<RemovalModalRef>) {
  const { modalId, objectName } = props;
  const [onDelete, setOnDelete] = useState<(() => Promise<void>) | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const modalRef = useRef<ModalRefType>(null);

  async function handleSubmitButtonClick() {
    if (onDelete && !isDeleting) {
      setIsDeleting(true);
      try {
        await onDelete();
        modalRef.current?.hide();
      } catch (error) {
        console.error('Error deleting:', error);
      } finally {
        setIsDeleting(false);
      }
    }
  }

  const buttonGroup: SubmitCancelBtnProps = {
    modalId,
    modalRef,
    submitButton: {
      label: 'Yes, Delete',
      uswdsStyle: UswdsButtonStyle.Secondary,
      onClick: handleSubmitButtonClick,
      disabled: isDeleting,
      closeOnClick: false,
    },
    cancelButton: {
      label: 'Cancel',
    },
  };

  function show(showProps: RemovalModalShowOptions) {
    setOnDelete(() => showProps.onDelete);
    if (modalRef.current?.show) {
      modalRef.current.show({ openModalButtonRef: showProps.openModalButtonRef });
    }
  }

  useImperativeHandle(ref, () => ({
    show,
    hide: () => modalRef.current?.hide(),
  }));

  return (
    <Modal
      ref={modalRef}
      modalId={modalId}
      heading={`Are you sure you want to delete this ${objectName}?`}
      content="This action can't be undone."
      actionButtonGroup={buttonGroup}
    />
  );
}

const RemovalModal = forwardRef(RemovalModal_);
export default RemovalModal;
