import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';

export type ChangeToDxtrConfirmModalRef = {
  show: (regionId: string, regionLabel: string) => void;
};

type ChangeToDxtrConfirmModalProps = {
  modalId: string;
  onConfirm: (regionId: string) => void;
};

export const ChangeToDxtrConfirmModal = forwardRef<
  ChangeToDxtrConfirmModalRef,
  ChangeToDxtrConfirmModalProps
>(function ChangeToDxtrConfirmModal({ modalId, onConfirm }, ref) {
  const modalRef = useRef<ModalRefType>(null);
  const [regionId, setRegionId] = useState('');
  const [regionLabel, setRegionLabel] = useState('');

  useImperativeHandle(ref, () => ({
    show(id: string, label: string) {
      setRegionId(id);
      setRegionLabel(label);
      modalRef.current?.show({});
    },
  }));

  function handleSubmit() {
    onConfirm(regionId);
  }

  const actionButtonGroup = {
    modalId,
    modalRef,
    submitButton: {
      label: 'Change to DXTR',
      onClick: handleSubmit,
    },
    cancelButton: {
      label: 'Cancel',
    },
  };

  return (
    <Modal
      ref={modalRef}
      modalId={modalId}
      heading={`Change Region ${regionLabel} to DXTR?`}
      actionButtonGroup={actionButtonGroup}
      content="This action can't be undone. The change takes effect on the next sync."
    />
  );
});
