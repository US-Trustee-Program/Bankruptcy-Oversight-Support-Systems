import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Modal from '@/lib/components/uswds/modal/Modal';
import Radio from '@/lib/components/uswds/Radio';
import { RadioGroup } from '@/lib/components/uswds/RadioGroup';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';

export type EditBankAssociationStatusModalRef = {
  show: (bankId: string, bankName: string, currentStatus: 'active' | 'inactive') => void;
  hide: () => void;
};

export type EditBankAssociationStatusModalProps = {
  modalId: string;
  onSave: (bankId: string, bankName: string, status: 'active' | 'inactive') => Promise<void>;
};

export const EditBankAssociationStatusModal = forwardRef<
  EditBankAssociationStatusModalRef,
  EditBankAssociationStatusModalProps
>(function EditBankAssociationStatusModal({ modalId, onSave }, ref) {
  const modalRef = useRef<ModalRefType>(null);
  const alert = useGlobalAlert();
  const [bankId, setBankId] = useState('');
  const [bankName, setBankName] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isPending, setIsPending] = useState(false);

  useImperativeHandle(ref, () => ({
    show(id: string, name: string, currentStatus: 'active' | 'inactive') {
      setBankId(id);
      setBankName(name);
      setStatus(currentStatus);
      modalRef.current?.show({});
    },
    hide() {
      modalRef.current?.hide();
    },
  }));

  async function handleSubmit() {
    setIsPending(true);
    try {
      await onSave(bankId, bankName, status);
    } catch {
      alert?.error('Failed to save bank association status. Please try again.');
    } finally {
      setIsPending(false);
    }
  }

  function handleCancel() {
    if (isPending) return;
    modalRef.current?.hide();
  }

  const actionButtonGroup = {
    modalId,
    modalRef,
    submitButton: {
      label: 'Save',
      onClick: handleSubmit,
      closeOnClick: false,
      disabled: isPending,
    },
    cancelButton: {
      label: 'Cancel',
      onClick: handleCancel,
      disabled: isPending,
    },
  };

  return (
    <Modal
      ref={modalRef}
      modalId={modalId}
      heading={`Edit ${bankName} Status`}
      actionButtonGroup={actionButtonGroup}
      content={
        <div>
          <p>
            Banks with an inactive status will not appear as a bank option for Trustees using this
            software. Marking a status as inactive will not remove it from existing Trustees.
          </p>
          <RadioGroup label="Status" className="status-radio-group">
            <Radio
              id={`${modalId}-status-active`}
              name={`${modalId}-status`}
              label="Active"
              value="active"
              checked={status === 'active'}
              onChange={() => setStatus('active')}
            />
            <Radio
              id={`${modalId}-status-inactive`}
              name={`${modalId}-status`}
              label="Inactive"
              value="inactive"
              checked={status === 'inactive'}
              onChange={() => setStatus('inactive')}
            />
          </RadioGroup>
        </div>
      }
    />
  );
});
