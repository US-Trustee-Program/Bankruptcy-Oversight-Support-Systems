import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Modal from '@/lib/components/uswds/modal/Modal';
import Radio from '@/lib/components/uswds/Radio';
import { RadioGroup } from '@/lib/components/uswds/RadioGroup';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';

export type EditBankAssociationStatusModalRef = {
  show: (bankId: string, bankName: string, currentStatus: 'active' | 'inactive') => void;
  hide: () => void;
};

export type EditBankAssociationStatusModalProps = {
  modalId: string;
  onSave: (bankId: string, bankName: string, status: 'active' | 'inactive') => void;
};

export const EditBankAssociationStatusModal = forwardRef<
  EditBankAssociationStatusModalRef,
  EditBankAssociationStatusModalProps
>(function EditBankAssociationStatusModal({ modalId, onSave }, ref) {
  const modalRef = useRef<ModalRefType>(null);
  const [bankId, setBankId] = useState('');
  const [bankName, setBankName] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

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

  function handleSubmit() {
    onSave(bankId, bankName, status);
  }

  function handleCancel() {
    modalRef.current?.hide();
  }

  const actionButtonGroup = {
    modalId,
    modalRef,
    submitButton: {
      label: 'Save',
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
      heading={`Edit ${bankName} Bank Status`}
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
