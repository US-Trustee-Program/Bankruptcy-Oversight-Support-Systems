import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Modal from '@/lib/components/uswds/modal/Modal';
import Input from '@/lib/components/uswds/Input';
import Radio from '@/lib/components/uswds/Radio';
import { RadioGroup } from '@/lib/components/uswds/RadioGroup';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';
import Api2 from '@/lib/models/api2';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';

export type EditSoftwareModalRef = {
  show: () => void;
  hide: () => void;
};

type EditSoftwareModalProps = {
  modalId: string;
  software: BankruptcySoftwareProfile;
  onSuccess: (updated: BankruptcySoftwareProfile) => void;
};

export const EditSoftwareModal = forwardRef<EditSoftwareModalRef, EditSoftwareModalProps>(
  function EditSoftwareModal({ modalId, software, onSuccess }, ref) {
    const modalRef = useRef<ModalRefType>(null);
    const alert = useGlobalAlert();

    const [name, setName] = useState('');
    const [status, setStatus] = useState<'active' | 'inactive'>('active');
    const [nameError, setNameError] = useState<string | null>(null);

    function resetForm() {
      setName(software.name);
      setStatus(software.status);
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
        setNameError('Software Name is required');
        return;
      }
      setNameError(null);

      try {
        const response = await Api2.updateSoftware(software.id, { name: trimmed, status });
        const updated = response!.data;
        onSuccess(updated);
        modalRef.current?.hide();
        alert?.success('Bankruptcy software updated successfully.');
      } catch (error) {
        getAppInsights()?.appInsights?.trackException({ exception: error as Error });
        alert?.error('Failed to update bankruptcy software. Please try again.');
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
        label: 'Edit Software',
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
        heading="Edit Bankruptcy Software"
        actionButtonGroup={actionButtonGroup}
        content={
          <div>
            <p>
              Updating the bankruptcy software name will change it everywhere it appears in CAMS.
            </p>
            <Input
              id={`${modalId}-software-name`}
              label="Software Name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              errorMessage={nameError ?? undefined}
              autoComplete="off"
            />
            <p>
              Bankruptcy software with an inactive status will not appear as a bankruptcy software
              option for Trustees. Marking a status as inactive will not remove it from existing
              Trustees.
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
