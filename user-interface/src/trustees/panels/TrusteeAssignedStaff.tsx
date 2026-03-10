import './TrusteeAssignedStaff.scss';
import { useEffect } from 'react';
import { useTrusteeAssignments } from '@/trustees/modals/UseTrusteeAssignments';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import StaffAssignmentCard from './StaffAssignmentCard';
import { CamsRole } from '@common/cams/roles';

interface TrusteeAssignedStaffProps {
  trusteeId: string;
}

export default function TrusteeAssignedStaff(props: Readonly<TrusteeAssignedStaffProps>) {
  const { trusteeId } = props;
  const { assignments, isLoading, error, getTrusteeOversightAssignments } = useTrusteeAssignments();

  useEffect(() => {
    getTrusteeOversightAssignments(trusteeId);
  }, [trusteeId, getTrusteeOversightAssignments]);

  const refreshAssignments = () => {
    getTrusteeOversightAssignments(trusteeId);
  };

  return (
    <div className="right-side-screen-content">
      <div className="trustee-assigned-staff-container">
        {error && (
          <Alert type={UswdsAlertStyle.Error} show={true}>
            {error}
          </Alert>
        )}

        <div className="assigned-staff-cards">
          <StaffAssignmentCard
            role={CamsRole.OversightAttorney}
            trusteeId={trusteeId}
            assignments={assignments}
            onAssignmentChange={refreshAssignments}
            isLoading={isLoading}
          />

          <StaffAssignmentCard
            role={CamsRole.OversightAuditor}
            trusteeId={trusteeId}
            assignments={assignments}
            onAssignmentChange={refreshAssignments}
            isLoading={isLoading}
          />

          <StaffAssignmentCard
            role={CamsRole.OversightParalegal}
            trusteeId={trusteeId}
            assignments={assignments}
            onAssignmentChange={refreshAssignments}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
