import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Modal from '@/lib/components/uswds/modal/Modal';
import Radio from '@/lib/components/uswds/Radio';
import { RadioGroup } from '@/lib/components/uswds/RadioGroup';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';
import Api2 from '@/lib/models/api2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';

export type EditBankAssociationStatusModalRef = {
  show: (bankId: string, bankName: string, currentStatus: 'active' | 'inactive') => void;
  hide: () => void;
};

type EditBankAssociationStatusModalProps = {
  modalId: string;
  softwareId: string;
  onSuccess: (software: BankruptcySoftwareProfile) => void;
};

export const EditBankAssociationStatusModal = forwardRef<
  EditBankAssociationStatusModalRef,
  EditBankAssociationStatusModalProps
>(function EditBankAssociationStatusModal({ modalId, softwareId, onSuccess }, ref) {
  const modalRef = useRef<ModalRefType>(null);
  const alert = useGlobalAlert();
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

  async function handleSubmit() {
    try {
      const response = await Api2.updateBankAssociationStatus(softwareId, bankId, status);
      onSuccess(response.data);
      modalRef.current?.hide();
      alert?.success(`${bankName} status has been updated.`);
    } catch {
      alert?.error('Failed to update bank status. Please try again.');
    }
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
