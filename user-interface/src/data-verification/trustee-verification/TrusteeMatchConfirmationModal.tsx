import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import './TrusteeMatchConfirmationModal.scss';
import Modal, { ModalShowOptions } from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { NewTabLink } from '@/lib/components/cams/NewTabLink/NewTabLink';
import { AccessibleFieldValue } from '@/lib/components/cams/AccessibleFieldValue/AccessibleFieldValue';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { DifferenceIcon } from './TrusteeComparisonTable';
import { ComparisonRow, ComparisonRowKey, SelectedTrustee } from './trustee-comparison';

interface TrusteeMatchConfirmationModalProps {
  id: string;
  rows: ComparisonRow[];
  source: Record<ComparisonRowKey, string | undefined>;
  caseCount: number;
  onConfirm: (selected: SelectedTrustee) => void;
  onCancel?: () => void;
  isProcessing?: boolean;
}

export type TrusteeMatchConfirmationModalImperative = {
  show: (selected: SelectedTrustee, options?: ModalShowOptions) => void;
  hide: () => void;
};

function caseAssignmentSentence(caseCount: number, trusteeName: string): string {
  const cases = caseCount === 1 ? '1 case' : `${caseCount} cases`;
  return `${cases} will be assigned to ${trusteeName}.`;
}

function TrusteeMatchConfirmationModal_(
  props: TrusteeMatchConfirmationModalProps,
  ref: React.Ref<TrusteeMatchConfirmationModalImperative>,
) {
  const { id, rows, source, caseCount, onConfirm, onCancel, isProcessing } = props;
  const modalRef = useRef<ModalRefType>(null);
  const [selected, setSelected] = useState<SelectedTrustee | null>(null);
  const processingRef = useRef<HTMLDivElement>(null);

  function show(trustee: SelectedTrustee, options?: ModalShowOptions) {
    setSelected(trustee);
    modalRef.current?.show(options ?? {});
  }

  // Disabling the submit button drops focus, so move it to the processing status instead.
  useEffect(() => {
    if (isProcessing) {
      processingRef.current?.focus();
    }
  }, [isProcessing]);

  function hide() {
    modalRef.current?.hide();
  }

  useImperativeHandle(ref, () => ({ show, hide }));

  const actionButtonGroup = {
    modalId: `trustee-confirmation-modal-${id}`,
    modalRef,
    submitButton: {
      label: isProcessing ? 'Matching Trustee...' : 'Match Trustee',
      disabled: isProcessing,
      // Without this, Modal closes itself on click by default, before isProcessing can render.
      closeOnClick: false,
      onClick: () => {
        if (selected) {
          onConfirm(selected);
        }
      },
    },
    cancelButton: {
      label: 'Cancel',
      disabled: isProcessing,
      onClick: () => {
        if (onCancel) onCancel();
        hide();
      },
    },
  };

  return (
    <Modal
      ref={modalRef}
      modalId={`trustee-confirmation-modal-${id}`}
      className="confirm-trustee-match-modal"
      forceAction={isProcessing}
      heading="Confirm Trustee Match"
      data-testid={`trustee-confirmation-modal-${id}`}
      content={
        selected ? (
          <>
            <p>Is this the same trustee as the information sent to CAMS?</p>
            <div className="confirm-match-comparison">
              <section className="confirm-match-column" data-testid="confirm-match-source">
                <h3>Information Sent to CAMS</h3>
                {rows.map(({ key, label }) => (
                  <AccessibleFieldValue key={key} label={label}>
                    {source[key] ?? 'Not Provided'}
                  </AccessibleFieldValue>
                ))}
              </section>
              <section className="confirm-match-column" data-testid="confirm-match-selected">
                <h3>Selected CAMS Trustee</h3>
                {rows.map(({ key, label }) => {
                  const { value, differs } = selected.cells[key];
                  return (
                    <AccessibleFieldValue key={key} label={label} className="confirm-match-field">
                      {key === 'name' ? (
                        <NewTabLink
                          to={`/trustees/${selected.trusteeId}`}
                          label={selected.trusteeName}
                        />
                      ) : (
                        (value ?? 'Not Provided')
                      )}
                      {value !== undefined && differs && <DifferenceIcon label={label} />}
                    </AccessibleFieldValue>
                  );
                })}
              </section>
            </div>
            <h3>What Happens Next</h3>
            <p>{caseAssignmentSentence(caseCount, selected.trusteeName)}</p>
          </>
        ) : null
      }
      footerContent={
        <div role="status" ref={processingRef} tabIndex={-1}>
          {isProcessing && (
            <>
              <LoadingSpinner aria-hidden="true" />
              <span>Matching trustee...</span>
            </>
          )}
        </div>
      }
      actionButtonGroup={actionButtonGroup}
    />
  );
}

const TrusteeMatchConfirmationModal = forwardRef(TrusteeMatchConfirmationModal_);
export default TrusteeMatchConfirmationModal;
