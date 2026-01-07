import { useRef, useCallback } from 'react';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { AttorneyUser } from '@common/cams/users';
import { CamsRole } from '@common/cams/roles';
import TrusteeAttorneyAssignmentModal, {
  TrusteeAttorneyAssignmentModalRef,
} from '../modals/TrusteeAttorneyAssignmentModal';
import './AttorneyAssignmentSection.scss';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';

interface AttorneyAssignmentSectionProps {
  trusteeId: string;
  assignments: TrusteeOversightAssignment[];
  attorneys: AttorneyUser[];
  onAssignmentChange: () => void;
  isLoading?: boolean;
}

export default function AttorneyAssignmentSection(props: Readonly<AttorneyAssignmentSectionProps>) {
  const { trusteeId, assignments, attorneys, onAssignmentChange, isLoading = false } = props;
  const modalRef = useRef<TrusteeAttorneyAssignmentModalRef>(null);
  const attorneyAssignment = assignments.find((a) => a.role === CamsRole.OversightAttorney);

  const handleAssignment = useCallback(
    (isAssigned: boolean) => {
      if (isAssigned) {
        onAssignmentChange();
      }
    },
    [onAssignmentChange],
  );

  const openAssignmentModal = useCallback(() => {
    modalRef.current?.show();
  }, []);

  if (isLoading) {
    return (
      <LoadingSpinner id="attorney-assignments-loading" caption="Loading attorney assignments..." />
    );
  }

  return (
    <div
      className="attorney-assignment-section record-detail-card-list"
      data-testid="attorney-assignment-section"
    >
      {attorneyAssignment ? (
        <div className="record-detail-card">
          <div className="title-bar">
            <h3>Attorney</h3>
            <Button
              uswdsStyle={UswdsButtonStyle.Unstyled}
              aria-label="Edit trustee's assigned attorney"
              title="Edit trustee's assigned attorney"
              onClick={openAssignmentModal}
            >
              <IconLabel icon="edit" label="Edit" />
            </Button>
          </div>
          <div className="assignment-display" data-testid="attorney-assignments-display">
            <div className="trustee-attorney-name">{attorneyAssignment.user.name}</div>
          </div>
        </div>
      ) : (
        <div className="record-detail-card">
          <div className="title-bar">
            <h3>Attorney</h3>
            <Button
              uswdsStyle={UswdsButtonStyle.Unstyled}
              aria-label="Add assigned attorney to trustee"
              title="Add assigned attorney to trustee"
              onClick={openAssignmentModal}
            >
              <IconLabel icon="add_circle" label="Add" />
            </Button>
          </div>
          <div className="no-assignment-state" data-testid="no-attorney-assigned">
            No attorney assigned
          </div>
        </div>
      )}

      <TrusteeAttorneyAssignmentModal
        ref={modalRef}
        modalId={`assign-attorney-modal-${trusteeId}`}
        trusteeId={trusteeId}
        attorneys={attorneys}
        currentAssignment={attorneyAssignment}
        onAssignment={handleAssignment}
      />
    </div>
  );
}
