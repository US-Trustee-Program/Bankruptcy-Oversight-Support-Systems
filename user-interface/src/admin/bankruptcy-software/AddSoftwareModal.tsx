import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Modal from '@/lib/components/uswds/modal/Modal';
import Input from '@/lib/components/uswds/Input';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';
import Api2 from '@/lib/models/api2';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';

export type AddSoftwareModalRef = {
  show: () => void;
  hide: () => void;
};

type AddSoftwareModalProps = {
  modalId: string;
  onSuccess: (software: BankruptcySoftwareProfile) => void;
};

export const AddSoftwareModal = forwardRef<AddSoftwareModalRef, AddSoftwareModalProps>(
  function AddSoftwareModal({ modalId, onSuccess }, ref) {
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
        setNameError('Software Name is required');
        return;
      }
      setNameError(null);

      try {
        const response = await Api2.createSoftware({ name: trimmed });
        onSuccess(response!.data);
        modalRef.current?.hide();
        alert?.success('Bankruptcy software added successfully.');
      } catch (error) {
        getAppInsights().appInsights.trackException({ exception: error as Error });
        alert?.error('Failed to add bankruptcy software. Please try again.');
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
        label: 'Add Software',
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
        heading="Add New Bankruptcy Software"
        actionButtonGroup={actionButtonGroup}
        content={
          <div>
            <Input
              id={`${modalId}-software-name`}
              label="Software Name"
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
  },
);
