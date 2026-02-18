import './TrusteeAssignedStaff.scss';
import { useEffect } from 'react';
import { useTrusteeAssignments } from '@/trustees/modals/UseTrusteeAssignments';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import AttorneyAssignmentCard from './AttorneyAssignmentCard';
import AuditorAssignmentCard from './AuditorAssignmentCard';
import ParalegalAssignmentCard from './ParalegalAssignmentCard';

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
        {error && <Alert type={UswdsAlertStyle.Error}>{error}</Alert>}

        <div className="assigned-staff-cards">
          <AttorneyAssignmentCard
            trusteeId={trusteeId}
            assignments={assignments}
            onAssignmentChange={refreshAssignments}
            isLoading={isLoading}
          />

          <AuditorAssignmentCard
            trusteeId={trusteeId}
            assignments={assignments}
            onAssignmentChange={refreshAssignments}
            isLoading={isLoading}
          />

          <ParalegalAssignmentCard
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
