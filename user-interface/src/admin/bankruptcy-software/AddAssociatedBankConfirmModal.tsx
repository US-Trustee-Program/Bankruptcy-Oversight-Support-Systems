import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';

export type AddAssociatedBankConfirmModalRef = {
  show: (bankId: string, bankName: string) => void;
  hide: () => void;
};

type AddAssociatedBankConfirmModalProps = {
  modalId: string;
  onConfirm: (bankId: string, bankName: string) => void;
};

export const AddAssociatedBankConfirmModal = forwardRef<
  AddAssociatedBankConfirmModalRef,
  AddAssociatedBankConfirmModalProps
>(function AddAssociatedBankConfirmModal({ modalId, onConfirm }, ref) {
  const modalRef = useRef<ModalRefType>(null);
  const [bankId, setBankId] = useState('');
  const [bankName, setBankName] = useState('');

  useImperativeHandle(ref, () => ({
    show(id: string, name: string) {
      setBankId(id);
      setBankName(name);
      modalRef.current?.show({});
    },
    hide() {
      modalRef.current?.hide();
    },
  }));

  function handleSubmit() {
    onConfirm(bankId, bankName);
    modalRef.current?.hide();
  }

  function handleCancel() {
    modalRef.current?.hide();
  }

  const actionButtonGroup = {
    modalId,
    modalRef,
    submitButton: {
      label: 'Add Bank',
      onClick: handleSubmit,
      closeOnClick: false,
    },
    cancelButton: {
      label: 'Cancel',
      onClick: handleCancel,
    },
  };

  return (
    <Modal
      ref={modalRef}
      modalId={modalId}
      heading={`Are you sure you want to add ${bankName}?`}
      actionButtonGroup={actionButtonGroup}
      content={
        <div>
          <p>In the future, you will only be able to mark their status as inactive.</p>
        </div>
      }
    />
  );
});
