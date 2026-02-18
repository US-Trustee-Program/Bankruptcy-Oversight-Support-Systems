import { useRef, useCallback } from 'react';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { CamsRole, OversightRoleType } from '@common/cams/roles';
import TrusteeOversightAssignmentModal, {
  TrusteeOversightAssignmentModalRef,
} from '../modals/TrusteeOversightAssignmentModal';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import StaffContactLinks from './StaffContactLinks';
import './StaffAssignmentCard.scss';

const ROLE_CONFIG: Record<OversightRoleType, { label: string; testIdPrefix: string }> = {
  [CamsRole.OversightAttorney]: { label: 'Attorney', testIdPrefix: 'attorney' },
  [CamsRole.OversightParalegal]: { label: 'Paralegal', testIdPrefix: 'paralegal' },
  [CamsRole.OversightAuditor]: { label: 'Auditor', testIdPrefix: 'auditor' },
};

interface StaffAssignmentCardProps {
  role: OversightRoleType;
  trusteeId: string;
  assignments: TrusteeOversightAssignment[];
  onAssignmentChange: () => void;
  isLoading?: boolean;
}

export default function StaffAssignmentCard(props: Readonly<StaffAssignmentCardProps>) {
  const { role, trusteeId, assignments, onAssignmentChange, isLoading = false } = props;
  const modalRef = useRef<TrusteeOversightAssignmentModalRef>(null);
  const assignment = assignments.find((a) => a.role === role);

  const config = ROLE_CONFIG[role];
  const { label, testIdPrefix } = config;

  const handleAssignment = useCallback(
    (isAssigned: boolean) => {
      if (isAssigned) {
        onAssignmentChange();
      }
    },
    [onAssignmentChange],
  );

  const openAssignmentModal = useCallback(() => {
    modalRef.current?.show(assignment);
  }, [assignment]);

  if (isLoading) {
    return (
      <LoadingSpinner
        id={`${testIdPrefix}-assignments-loading`}
        caption={`Loading ${label.toLowerCase()} assignments...`}
      />
    );
  }

  return (
    <div
      className="staff-assignment-card-container"
      data-testid={`${testIdPrefix}-assignment-section`}
    >
      <div className="staff-assignment-card usa-card">
        <div className="usa-card__container">
          <div className="usa-card__body">
            <div className="staff-assignment-card-header">
              <h4>{label}</h4>
              <Button
                id={
                  assignment ? `edit-${testIdPrefix}-assignment` : `add-${testIdPrefix}-assignment`
                }
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label={
                  assignment
                    ? `Edit trustee's assigned ${label.toLowerCase()}`
                    : `Add assigned ${label.toLowerCase()} to trustee`
                }
                title={
                  assignment
                    ? `Edit trustee's assigned ${label.toLowerCase()}`
                    : `Add assigned ${label.toLowerCase()} to trustee`
                }
                onClick={openAssignmentModal}
              >
                <IconLabel
                  icon={assignment ? 'edit' : 'add_circle'}
                  label={assignment ? 'Edit' : 'Add'}
                />
              </Button>
            </div>
            {assignment ? (
              <div data-testid={`${testIdPrefix}-assignments-display`}>
                <div className="staff-name">{assignment.user.name}</div>
                <StaffContactLinks user={assignment.user} />
              </div>
            ) : (
              <div data-testid={`no-${testIdPrefix}-assigned`}>
                No {label.toLowerCase()} assigned
              </div>
            )}
          </div>
        </div>
      </div>

      <TrusteeOversightAssignmentModal
        ref={modalRef}
        modalId={`assign-${testIdPrefix}-modal-${trusteeId}`}
        trusteeId={trusteeId}
        role={role}
        onAssignment={handleAssignment}
      />
    </div>
  );
}
