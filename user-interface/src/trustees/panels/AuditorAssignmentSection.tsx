import { useRef, useCallback } from 'react';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { OversightRole } from '@common/cams/roles';
import TrusteeAuditorAssignmentModal, {
  TrusteeAuditorAssignmentModalRef,
} from '../modals/TrusteeAuditorAssignmentModal';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';

interface AuditorAssignmentSectionProps {
  trusteeId: string;
  assignments: TrusteeOversightAssignment[];
  onAssignmentChange: () => void;
}

export default function AuditorAssignmentSection(props: Readonly<AuditorAssignmentSectionProps>) {
  const { trusteeId, assignments, onAssignmentChange } = props;
  const modalRef = useRef<TrusteeAuditorAssignmentModalRef>(null);
  const auditorAssignment = assignments.find((a) => a.role === OversightRole.OversightAuditor);

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

  return (
    <div
      className="staff-assignment-section record-detail-card-list"
      data-testid="auditor-assignment-section"
    >
      {auditorAssignment ? (
        <div className="record-detail-card">
          <div className="title-bar">
            <h3>Auditor</h3>
            <Button
              uswdsStyle={UswdsButtonStyle.Unstyled}
              aria-label="Edit trustee's assigned auditor"
              title="Edit trustee's assigned auditor"
              onClick={openAssignmentModal}
            >
              <IconLabel icon="edit" label="Edit" />
            </Button>
          </div>
          <div className="assignment-display" data-testid="auditor-assignments-display">
            <div className="trustee-staff-name">{auditorAssignment.user.name}</div>
          </div>
        </div>
      ) : (
        <div className="record-detail-card">
          <div className="title-bar">
            <h3>Auditor</h3>
            <Button
              uswdsStyle={UswdsButtonStyle.Unstyled}
              aria-label="Add assigned auditor to trustee"
              title="Add assigned auditor to trustee"
              onClick={openAssignmentModal}
            >
              <IconLabel icon="add_circle" label="Add" />
            </Button>
          </div>
          <div className="no-assignment-state" data-testid="no-auditor-assigned">
            No auditor assigned
          </div>
        </div>
      )}

      <TrusteeAuditorAssignmentModal
        ref={modalRef}
        modalId={`assign-auditor-modal-${trusteeId}`}
        trusteeId={trusteeId}
        onAssignment={handleAssignment}
      />
    </div>
  );
}
