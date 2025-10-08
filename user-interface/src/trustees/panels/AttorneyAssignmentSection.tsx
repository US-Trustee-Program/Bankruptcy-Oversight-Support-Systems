import { useRef, useCallback } from 'react';
import Button from '@/lib/components/uswds/Button';
import { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import Alert from '@/lib/components/uswds/Alert';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { OversightRole } from '@common/cams/roles';
import TrusteeAttorneyAssignmentModal, {
  TrusteeAttorneyAssignmentModalRef,
} from '../modals/TrusteeAttorneyAssignmentModal';
import './AttorneyAssignmentSection.scss';

interface AttorneyAssignmentSectionProps {
  trusteeId: string;
  assignments: TrusteeOversightAssignment[];
  onAssignmentChange: () => void;
  isLoading?: boolean;
}

export default function AttorneyAssignmentSection({
  trusteeId,
  assignments,
  onAssignmentChange,
  isLoading = false,
}: AttorneyAssignmentSectionProps) {
  const modalRef = useRef<TrusteeAttorneyAssignmentModalRef>(null);
  const attorneyAssignments = assignments.filter((a) => a.role === OversightRole.TrialAttorney);

  const handleAssignmentCreated = useCallback(
    (_assignment: TrusteeOversightAssignment) => {
      onAssignmentChange();
    },
    [onAssignmentChange],
  );

  const openAssignmentModal = useCallback(() => {
    modalRef.current?.show();
  }, []);

  if (isLoading) {
    return (
      <LoadingSpinner
        caption="Loading attorney assignments..."
        data-testid="attorney-assignments-loading"
      />
    );
  }

  return (
    <div className="attorney-assignment-section" data-testid="attorney-assignment-section">
      <div className="section-header">
        <h3>Attorney Assignment</h3>
      </div>

      {attorneyAssignments.length === 0 ? (
        <div className="no-assignment-state" data-testid="no-attorney-assigned">
          <Alert type={UswdsAlertStyle.Info}>No attorney assigned to this trustee.</Alert>
          <Button
            uswdsStyle={UswdsButtonStyle.Default}
            onClick={openAssignmentModal}
            data-testid="assign-attorney-button"
          >
            Assign Attorney
          </Button>
        </div>
      ) : (
        <div className="assignment-display" data-testid="attorney-assignments-display">
          {attorneyAssignments.map((assignment) => (
            <div key={assignment.id} className="assignment-item" data-testid="assignment-item">
              <div className="attorney-info">
                <strong>{assignment.user.name}</strong>
                <span className="assignment-role">Trial Attorney</span>
              </div>
              <div className="assignment-actions">
                <Button
                  uswdsStyle={UswdsButtonStyle.Outline}
                  onClick={() => {
                    // Future: View attorney details
                  }}
                >
                  View Details
                </Button>
              </div>
            </div>
          ))}
          <Button
            uswdsStyle={UswdsButtonStyle.Outline}
            onClick={openAssignmentModal}
            disabled={attorneyAssignments.length >= 1} // Business rule: one attorney per trustee
            data-testid="change-attorney-button"
          >
            Change Attorney
          </Button>

          {attorneyAssignments.length > 0 && (
            <div className="assignment-audit-link">
              <a
                href={`/trustees/${trusteeId}/audit-history`}
                data-testid="view-assignment-history-link"
              >
                View Assignment History
              </a>
            </div>
          )}
        </div>
      )}

      <TrusteeAttorneyAssignmentModal
        ref={modalRef}
        modalId={`assign-attorney-modal-${trusteeId}`}
        trusteeId={trusteeId}
        onAssignmentCreated={handleAssignmentCreated}
      />
    </div>
  );
}
