import { useEffect } from 'react';
import { Trustee } from '@common/cams/trustees';
import { useTrusteeAssignments } from '@/trustees/modals/UseTrusteeAssignments';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import AttorneyAssignmentSection from './AttorneyAssignmentSection';
import './TrusteeAssignedStaff.scss';

interface TrusteeAssignedStaffProps {
  trusteeId: string;
  trustee: Trustee;
}

export default function TrusteeAssignedStaff({ trusteeId, trustee }: TrusteeAssignedStaffProps) {
  const { assignments, isLoading, error, getTrusteeOversightAssignments, clearError } =
    useTrusteeAssignments();

  useEffect(() => {
    getTrusteeOversightAssignments(trusteeId);
  }, [trusteeId, getTrusteeOversightAssignments]);

  const refreshAssignments = () => {
    getTrusteeOversightAssignments(trusteeId);
  };

  return (
    <div className="trustee-assigned-staff" data-testid="trustee-assigned-staff">
      <div className="page-header">
        <h2>Staff Assigned to {trustee.name}</h2>
        <p className="subheader">
          Manage staff members assigned to provide oversight for this trustee
        </p>
      </div>

      {error && (
        <Alert type={UswdsAlertStyle.Error}>
          {error}
          <button className="usa-button--unstyled" onClick={clearError}>
            Dismiss
          </button>
        </Alert>
      )}

      <div className="assignments-container">
        <AttorneyAssignmentSection
          trusteeId={trusteeId}
          assignments={assignments}
          onAssignmentChange={refreshAssignments}
          isLoading={isLoading}
        />

        {/* Future sections for other staff types would be added here */}
      </div>
    </div>
  );
}
