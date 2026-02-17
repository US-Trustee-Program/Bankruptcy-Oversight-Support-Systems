import { useRef, useCallback } from 'react';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { CamsRole } from '@common/cams/roles';
import TrusteeOversightAssignmentModal, {
  TrusteeOversightAssignmentModalRef,
} from '../modals/TrusteeOversightAssignmentModal';
import './ParalegalAssignmentCard.scss';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import StaffContactLinks from './StaffContactLinks';

interface ParalegalAssignmentCardProps {
  trusteeId: string;
  assignments: TrusteeOversightAssignment[];
  onAssignmentChange: () => void;
  isLoading?: boolean;
}

export default function ParalegalAssignmentCard(props: Readonly<ParalegalAssignmentCardProps>) {
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
    <div className="paralegal-assignment-card-container" data-testid="paralegal-assignment-section">
      <div className="paralegal-assignment-card usa-card">
        <div className="usa-card__container">
          <div className="usa-card__body">
            <div className="paralegal-assignment-card-header">
              <h4>Paralegal</h4>
              <Button
                id={paralegalAssignment ? 'edit-paralegal-assignment' : 'add-paralegal-assignment'}
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label={
                  paralegalAssignment
                    ? "Edit trustee's assigned paralegal"
                    : 'Add assigned paralegal to trustee'
                }
                title={
                  paralegalAssignment
                    ? "Edit trustee's assigned paralegal"
                    : 'Add assigned paralegal to trustee'
                }
                onClick={openAssignmentModal}
              >
                <IconLabel
                  icon={paralegalAssignment ? 'edit' : 'add_circle'}
                  label={paralegalAssignment ? 'Edit' : 'Add'}
                />
              </Button>
            </div>
            {paralegalAssignment ? (
              <div data-testid="paralegal-assignments-display">
                <div className="paralegal-name">{paralegalAssignment.user.name}</div>
                <StaffContactLinks user={paralegalAssignment.user} />
              </div>
            ) : (
              <div data-testid="no-paralegal-assigned">No paralegal assigned</div>
            )}
          </div>
        </div>
      </div>

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
