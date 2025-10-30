import { useEffect } from 'react';
import { useTrusteeAssignments } from '@/trustees/modals/UseTrusteeAssignments';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import AttorneyAssignmentSection from './AttorneyAssignmentSection';
import AuditorAssignmentSection from './AuditorAssignmentSection';
import './TrusteeAssignedStaff.scss';

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
      <div className="record-detail-container">
        {error && <Alert type={UswdsAlertStyle.Error}>{error}</Alert>}

        {isLoading ? (
          <LoadingSpinner id="staff-assignments-loading" caption="Loading staff assignments..." />
        ) : (
          <>
            <AttorneyAssignmentSection
              trusteeId={trusteeId}
              assignments={assignments}
              onAssignmentChange={refreshAssignments}
            />
            <AuditorAssignmentSection
              trusteeId={trusteeId}
              assignments={assignments}
              onAssignmentChange={refreshAssignments}
            />
          </>
        )}
      </div>
    </div>
  );
}
