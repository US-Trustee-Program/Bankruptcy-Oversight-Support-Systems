import './EditBankModal.scss';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Modal from '@/lib/components/uswds/modal/Modal';
import Input from '@/lib/components/uswds/Input';
import Radio from '@/lib/components/uswds/Radio';
import { RadioGroup } from '@/lib/components/uswds/RadioGroup';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { BankProfile } from '@common/cams/banks';
import Api2 from '@/lib/models/api2';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';

export type EditBankModalRef = {
  show: () => void;
  hide: () => void;
};

type EditBankModalProps = {
  modalId: string;
  bank: BankProfile;
  onSuccess: (bank: BankProfile) => void;
};

export const EditBankModal = forwardRef<EditBankModalRef, EditBankModalProps>(
  function EditBankModal({ modalId, bank, onSuccess }, ref) {
    const modalRef = useRef<ModalRefType>(null);
    const alert = useGlobalAlert();

    const [name, setName] = useState('');
    const [status, setStatus] = useState<'active' | 'inactive'>('active');
    const [nameError, setNameError] = useState<string | null>(null);

    function resetForm() {
      setName(bank.name);
      setStatus(bank.status);
      setNameError(null);
    }

    useImperativeHandle(ref, () => ({
      show() {
        resetForm();
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
        const response = await Api2.updateBank(bank.id, { name: trimmed, status });
        const updated = response.data;
        onSuccess(updated);
        modalRef.current?.hide();
        alert?.success('Bank updated successfully.');
      } catch (error) {
        getAppInsights()?.appInsights?.trackException({ exception: error as Error });
        alert?.error('Failed to update bank. Please try again.');
      }
    }

    function handleCancel() {
      resetForm();
      modalRef.current?.hide();
    }

    const actionButtonGroup = {
      modalId,
      modalRef,
      submitButton: {
        label: 'Edit Bank',
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
        heading="Edit Bank"
        actionButtonGroup={actionButtonGroup}
        content={
          <div>
            <p>Updating the bank name will change it everywhere it appears in CAMS.</p>
            <Input
              id={`${modalId}-bank-name`}
              label="Bank Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              errorMessage={nameError ?? undefined}
              autoComplete="off"
            />
            <p>
              Banks with an inactive status will not appear as a bank option for Trustees. Marking a
              status as inactive will not remove it from existing Trustees.
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
  },
);
