import { useRef, useCallback } from 'react';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { CamsRole } from '@common/cams/roles';
import TrusteeOversightAssignmentModal, {
  TrusteeOversightAssignmentModalRef,
} from '../modals/TrusteeOversightAssignmentModal';
import './ParalegalAssignmentSection.scss';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';

interface ParalegalAssignmentSectionProps {
  trusteeId: string;
  assignments: TrusteeOversightAssignment[];
  onAssignmentChange: () => void;
  isLoading?: boolean;
}

export default function ParalegalAssignmentSection(
  props: Readonly<ParalegalAssignmentSectionProps>,
) {
  const { trusteeId, assignments, onAssignmentChange, isLoading = false } = props;
  const modalRef = useRef<TrusteeOversightAssignmentModalRef>(null);
  const paralegalAssignment = assignments.find((a) => a.role === CamsRole.OversightParalegal);

  const handleAssignment = useCallback(
    (isAssigned: boolean) => {
      if (isAssigned) {
        onAssignmentChange();
      }
    },
    [onAssignmentChange],
  );

  const openAssignmentModal = useCallback(() => {
    modalRef.current?.show(paralegalAssignment);
  }, [paralegalAssignment]);

  if (isLoading) {
    return (
      <LoadingSpinner
        id="paralegal-assignments-loading"
        caption="Loading paralegal assignments..."
      />
    );
  }

  return (
    <div
      className="paralegal-assignment-section record-detail-card-list"
      data-testid="paralegal-assignment-section"
    >
      {paralegalAssignment ? (
        <div className="record-detail-card">
          <div className="title-bar">
            <h3>Paralegal</h3>
            <Button
              uswdsStyle={UswdsButtonStyle.Unstyled}
              aria-label="Edit trustee's assigned paralegal"
              title="Edit trustee's assigned paralegal"
              onClick={openAssignmentModal}
            >
              <IconLabel icon="edit" label="Edit" />
            </Button>
          </div>
          <div className="assignment-display" data-testid="paralegal-assignments-display">
            <div className="trustee-paralegal-name">{paralegalAssignment.user.name}</div>
          </div>
        </div>
      ) : (
        <div className="record-detail-card">
          <div className="title-bar">
            <h3>Paralegal</h3>
            <Button
              uswdsStyle={UswdsButtonStyle.Unstyled}
              aria-label="Add assigned paralegal to trustee"
              title="Add assigned paralegal to trustee"
              onClick={openAssignmentModal}
            >
              <IconLabel icon="add_circle" label="Add" />
            </Button>
          </div>
          <div className="no-assignment-state" data-testid="no-paralegal-assigned">
            No paralegal assigned
          </div>
        </div>
      )}

      <TrusteeOversightAssignmentModal
        ref={modalRef}
        modalId={`assign-paralegal-modal-${trusteeId}`}
        trusteeId={trusteeId}
        role={CamsRole.OversightParalegal}
        onAssignment={handleAssignment}
      />
    </div>
  );
}
