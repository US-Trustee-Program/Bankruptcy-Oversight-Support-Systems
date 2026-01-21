import { useRef, useCallback } from 'react';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { TrusteeOversightAssignment } from '@common/cams/trustees';
import { CamsRole } from '@common/cams/roles';
import TrusteeOversightAssignmentModal, {
  TrusteeOversightAssignmentModalRef,
} from '../modals/TrusteeOversightAssignmentModal';
import './AuditorAssignmentSection.scss';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';

interface AuditorAssignmentSectionProps {
  trusteeId: string;
  assignments: TrusteeOversightAssignment[];
  onAssignmentChange: () => void;
  isLoading?: boolean;
}

export default function AuditorAssignmentSection(props: Readonly<AuditorAssignmentSectionProps>) {
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
    <div
      className="auditor-assignment-section record-detail-card-list"
      data-testid="auditor-assignment-section"
    >
      {auditorAssignment ? (
        <div className="record-detail-card">
          <div className="title-bar">
            <h3>
              Auditor
              <Button
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label="Edit trustee's assigned auditor"
                title="Edit trustee's assigned auditor"
                onClick={openAssignmentModal}
              >
                <IconLabel icon="edit" label="Edit" />
              </Button>
            </h3>
          </div>
          <div className="assignment-display" data-testid="auditor-assignments-display">
            <div className="trustee-auditor-name">{auditorAssignment.user.name}</div>
          </div>
        </div>
      ) : (
        <div className="record-detail-card">
          <div className="title-bar">
            <h3>
              Auditor
              <Button
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label="Add assigned auditor to trustee"
                title="Add assigned auditor to trustee"
                onClick={openAssignmentModal}
              >
                <IconLabel icon="add_circle" label="Add" />
              </Button>
            </h3>
          </div>
          <div className="no-assignment-state" data-testid="no-auditor-assigned">
            No auditor assigned
          </div>
        </div>
      )}

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
