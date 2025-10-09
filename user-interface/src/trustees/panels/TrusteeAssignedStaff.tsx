import { useEffect } from 'react';
import { Trustee } from '@common/cams/trustees';
import { useTrusteeAssignments } from '@/lib/hooks/UseTrusteeAssignments';
import Alert from '@/lib/components/uswds/Alert';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import AttorneyAssignmentSection from './AttorneyAssignmentSection';
import './TrusteeAssignedStaff.scss';

interface TrusteeAssignedStaffProps {
  trusteeId: string;
  trustee: Trustee;
}

export default function TrusteeAssignedStaff({ trusteeId }: TrusteeAssignedStaffProps) {
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
