import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import './TrusteeMatchConfirmationModal.scss';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { NewTabLink } from '@/lib/components/cams/NewTabLink/NewTabLink';
import { CandidateScore } from '@common/cams/dataflow-events';
import { formatAppointmentStatus } from '@common/cams/trustee-appointments';
import { formatChapterType } from '@common/cams/trustees';

interface TrusteeMatchConfirmationModalProps {
  id: string;
  onConfirm: (candidate: CandidateScore) => void;
  onCancel?: () => void;
}

export type TrusteeMatchConfirmationModalImperative = {
  show: (candidate: CandidateScore) => void;
  hide: () => void;
};

function TrusteeMatchConfirmationModal_(
  props: TrusteeMatchConfirmationModalProps,
  ref: React.Ref<TrusteeMatchConfirmationModalImperative>,
) {
  const { id, onConfirm, onCancel } = props;
  const modalRef = useRef<ModalRefType>(null);
  const [candidate, setCandidate] = useState<CandidateScore | null>(null);

  function show(c: CandidateScore) {
    setCandidate(c);
    modalRef.current?.show({});
  }

  function hide() {
    modalRef.current?.hide();
  }

  useImperativeHandle(ref, () => ({ show, hide }));

  const actionButtonGroup = {
    modalId: `trustee-confirmation-modal-${id}`,
    modalRef,
    submitButton: {
      label: 'Confirm Appointment',
      onClick: () => {
        if (candidate) {
          onConfirm(candidate);
          hide();
        }
      },
    },
    cancelButton: {
      label: 'Cancel',
      onClick: () => {
        if (onCancel) onCancel();
        hide();
      },
    },
  };

  const addressLines = candidate?.address
    ? [
        candidate.address.address1,
        candidate.address.address2,
        candidate.address.address3,
        [
          candidate.address.city,
          [candidate.address.state, candidate.address.zipCode].filter(Boolean).join(' '),
        ]
          .filter(Boolean)
          .join(', '),
      ].filter(Boolean)
    : [];

  return (
    <Modal
      ref={modalRef}
      modalId={`trustee-confirmation-modal-${id}`}
      className="confirm-modal"
      heading="Confirm Trustee"
      data-testid={`trustee-confirmation-modal-${id}`}
      content={
        candidate ? (
          <>
            <p>Are you sure you want to confirm the appointment of the following trustee?</p>
            <div className="trustee-contact">
              <div className="trustee-name">
                <NewTabLink to={`/trustees/${candidate.trusteeId}`} label={candidate.trusteeName} />
              </div>
              {addressLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
              {candidate.phone && (
                <div className="phone">
                  {candidate.phone.number}
                  {candidate.phone.extension ? ` x${candidate.phone.extension}` : ''}
                </div>
              )}
              {candidate.email && <div className="email">{candidate.email}</div>}
              {candidate.appointments?.map((appt, i) => (
                <div key={i}>
                  {[appt.courtName, appt.courtDivisionName].filter(Boolean).join(' ')}: Chap{' '}
                  {formatChapterType(appt.chapter)} - {formatAppointmentStatus(appt.status)}
                </div>
              ))}
            </div>
          </>
        ) : null
      }
      actionButtonGroup={actionButtonGroup}
    />
  );
}

const TrusteeMatchConfirmationModal = forwardRef(TrusteeMatchConfirmationModal_);
export default TrusteeMatchConfirmationModal;
