import { useRef, useCallback } from 'react';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { CamsRole } from '@common/cams/roles';
import TrusteeOversightAssignmentModal, {
  TrusteeOversightAssignmentModalRef,
} from '../modals/TrusteeOversightAssignmentModal';
import './AuditorAssignmentCard.scss';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import StaffContactLinks from './StaffContactLinks';

interface AuditorAssignmentCardProps {
  trusteeId: string;
  assignments: TrusteeOversightAssignment[];
  onAssignmentChange: () => void;
  isLoading?: boolean;
}

export default function AuditorAssignmentCard(props: Readonly<AuditorAssignmentCardProps>) {
  const { trusteeId, assignments, onAssignmentChange, isLoading = false } = props;
  const modalRef = useRef<TrusteeOversightAssignmentModalRef>(null);
  const auditorAssignment = assignments.find((a) => a.role === CamsRole.OversightAuditor);

  const handleAssignment = useCallback(
    (isAssigned: boolean) => {
      if (isAssigned) {
        onAssignmentChange();
      }
    },
    [onAssignmentChange],
  );

  const openAssignmentModal = useCallback(() => {
    modalRef.current?.show(auditorAssignment);
  }, [auditorAssignment]);

  if (isLoading) {
    return (
      <LoadingSpinner id="auditor-assignments-loading" caption="Loading auditor assignments..." />
    );
  }

  return (
    <div className="auditor-assignment-card-container" data-testid="auditor-assignment-section">
      <div className="auditor-assignment-card usa-card">
        <div className="usa-card__container">
          <div className="usa-card__body">
            <div className="auditor-assignment-card-header">
              <h4>Auditor</h4>
              <Button
                id={auditorAssignment ? 'edit-auditor-assignment' : 'add-auditor-assignment'}
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label={
                  auditorAssignment
                    ? "Edit trustee's assigned auditor"
                    : 'Add assigned auditor to trustee'
                }
                title={
                  auditorAssignment
                    ? "Edit trustee's assigned auditor"
                    : 'Add assigned auditor to trustee'
                }
                onClick={openAssignmentModal}
              >
                <IconLabel
                  icon={auditorAssignment ? 'edit' : 'add_circle'}
                  label={auditorAssignment ? 'Edit' : 'Add'}
                />
              </Button>
            </div>
            {auditorAssignment ? (
              <div data-testid="auditor-assignments-display">
                <div className="auditor-name">{auditorAssignment.user.name}</div>
                <StaffContactLinks user={auditorAssignment.user} />
              </div>
            ) : (
              <div data-testid="no-auditor-assigned">No auditor assigned</div>
            )}
          </div>
        </div>
      </div>

      <TrusteeOversightAssignmentModal
        ref={modalRef}
        modalId={`assign-auditor-modal-${trusteeId}`}
        trusteeId={trusteeId}
        role={CamsRole.OversightAuditor}
        onAssignment={handleAssignment}
      />
    </div>
  );
}
