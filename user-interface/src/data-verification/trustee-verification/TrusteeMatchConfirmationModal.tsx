import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import Icon from '@/lib/components/uswds/Icon';
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
            <p>
              <Link
                to={`/trustees/${candidate.trusteeId}`}
                target="_blank"
                rel="noreferrer"
                className="case-link"
              >
                <Icon name="launch" />
                {candidate.trusteeName}
              </Link>
            </p>
            {addressLines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            {candidate.phone && (
              <p>
                {candidate.phone.number}
                {candidate.phone.extension ? ` x${candidate.phone.extension}` : ''}
              </p>
            )}
            {candidate.email && <p>{candidate.email}</p>}
            {candidate.appointments?.map((appt, i) => (
              <p key={i}>
                {[appt.courtName, appt.courtDivisionName].filter(Boolean).join(' ')}: Chap{' '}
                {formatChapterType(appt.chapter)} - {formatAppointmentStatus(appt.status)}
              </p>
            ))}
          </>
        ) : null
      }
      actionButtonGroup={actionButtonGroup}
    />
  );
}

const TrusteeMatchConfirmationModal = forwardRef(TrusteeMatchConfirmationModal_);
export default TrusteeMatchConfirmationModal;
