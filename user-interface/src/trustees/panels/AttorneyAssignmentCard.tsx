import { useRef, useCallback } from 'react';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { CamsRole } from '@common/cams/roles';
import TrusteeOversightAssignmentModal, {
  TrusteeOversightAssignmentModalRef,
} from '../modals/TrusteeOversightAssignmentModal';
import './AttorneyAssignmentCard.scss';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import StaffContactLinks from './StaffContactLinks';

interface AttorneyAssignmentCardProps {
  trusteeId: string;
  assignments: TrusteeOversightAssignment[];
  onAssignmentChange: () => void;
  isLoading?: boolean;
}

export default function AttorneyAssignmentCard(props: Readonly<AttorneyAssignmentCardProps>) {
  const { trusteeId, assignments, onAssignmentChange, isLoading = false } = props;
  const modalRef = useRef<TrusteeOversightAssignmentModalRef>(null);
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
    modalRef.current?.show(attorneyAssignment);
  }, [attorneyAssignment]);

  if (isLoading) {
    return (
      <LoadingSpinner id="attorney-assignments-loading" caption="Loading attorney assignments..." />
    );
  }

  return (
    <div className="attorney-assignment-card-container" data-testid="attorney-assignment-section">
      <div className="attorney-assignment-card usa-card">
        <div className="usa-card__container">
          <div className="usa-card__body">
            <div className="attorney-assignment-card-header">
              <h4>Attorney</h4>
              <Button
                id={attorneyAssignment ? 'edit-attorney-assignment' : 'add-attorney-assignment'}
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label={
                  attorneyAssignment
                    ? "Edit trustee's assigned attorney"
                    : 'Add assigned attorney to trustee'
                }
                title={
                  attorneyAssignment
                    ? "Edit trustee's assigned attorney"
                    : 'Add assigned attorney to trustee'
                }
                onClick={openAssignmentModal}
              >
                <IconLabel
                  icon={attorneyAssignment ? 'edit' : 'add_circle'}
                  label={attorneyAssignment ? 'Edit' : 'Add'}
                />
              </Button>
            </div>
            {attorneyAssignment ? (
              <div data-testid="attorney-assignments-display">
                <div className="attorney-name">{attorneyAssignment.user.name}</div>
                <StaffContactLinks user={attorneyAssignment.user} />
              </div>
            ) : (
              <div data-testid="no-attorney-assigned">No attorney assigned</div>
            )}
          </div>
        </div>
      </div>

      <TrusteeOversightAssignmentModal
        ref={modalRef}
        modalId={`assign-attorney-modal-${trusteeId}`}
        trusteeId={trusteeId}
        role={CamsRole.OversightAttorney}
        onAssignment={handleAssignment}
      />
    </div>
  );
}
