import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Modal from '@/lib/components/uswds/modal/Modal';
import Input from '@/lib/components/uswds/Input';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { BankProfile } from '@common/cams/banks';
import Api2 from '@/lib/models/api2';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';

export type AddBankModalRef = {
  show: () => void;
  hide: () => void;
};

type AddBankModalProps = {
  modalId: string;
  onSuccess: (bank: BankProfile) => void;
};

export const AddBankModal = forwardRef<AddBankModalRef, AddBankModalProps>(function AddBankModal(
  { modalId, onSuccess },
  ref,
) {
  const modalRef = useRef<ModalRefType>(null);
  const alert = useGlobalAlert();

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  function clearForm() {
    setName('');
    setNameError(null);
  }

  useImperativeHandle(ref, () => ({
    show() {
      clearForm();
      modalRef.current?.show({});
    },
    hide() {
      modalRef.current?.hide();
    },
  }));

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Bank Name is required');
      return;
    }
    setNameError(null);

    try {
      const response = await Api2.createBank({ name: trimmed });
      const created = (response as { data: BankProfile }).data;
      onSuccess(created);
      modalRef.current?.hide();
      alert?.success('Bank added successfully.');
    } catch (error) {
      getAppInsights().appInsights.trackException({ exception: error as Error });
      alert?.error('Failed to add bank. Please try again.');
    }
  }

  function handleCancel() {
    clearForm();
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
      heading="Add Bank"
      actionButtonGroup={actionButtonGroup}
      content={
        <div>
          <Input
            id={`${modalId}-bank-name`}
            label="Bank Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            errorMessage={nameError ?? undefined}
            autoComplete="off"
          />
        </div>
      }
    />
  );
});
