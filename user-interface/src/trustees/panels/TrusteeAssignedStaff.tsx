import './TrusteeAssignedStaff.scss';
import { useEffect, useState } from 'react';
import { useTrusteeAssignments } from '@/trustees/modals/UseTrusteeAssignments';
import Api2 from '@/lib/models/api2';
import { AttorneyUser } from '@common/cams/users';
import { CamsRole } from '@common/cams/roles';
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
  const [attorneys, setAttorneys] = useState<AttorneyUser[]>([]);
  const [attorneysLoading, setAttorneysLoading] = useState<boolean>(true);
  const [attorneysError, setAttorneysError] = useState<string | null>(null);

  useEffect(() => {
    getTrusteeOversightAssignments(trusteeId);
  }, [trusteeId, getTrusteeOversightAssignments]);

  useEffect(() => {
    const loadAttorneys = async () => {
      setAttorneysLoading(true);
      setAttorneysError(null);
      try {
        const response = await Api2.getOversightStaff();
        const staffByRole = response.data ?? {};
        setAttorneys(staffByRole[CamsRole.OversightAttorney] ?? []);
      } catch {
        setAttorneysError('Failed to load attorneys');
      } finally {
        setAttorneysLoading(false);
      }
    };

    loadAttorneys();
  }, []);

  const refreshAssignments = () => {
    getTrusteeOversightAssignments(trusteeId);
  };

  return (
    <div className="right-side-screen-content">
      <div className="trustee-assigned-staff-container">
        {error && <Alert type={UswdsAlertStyle.Error}>{error}</Alert>}
        {attorneysError && <Alert type={UswdsAlertStyle.Error}>{attorneysError}</Alert>}

        <div className="assigned-staff-cards">
          <AttorneyAssignmentCard
            trusteeId={trusteeId}
            assignments={assignments}
            attorneys={attorneys}
            onAssignmentChange={refreshAssignments}
            isLoading={isLoading || attorneysLoading}
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
