import { useEffect, useState } from 'react';
import { useTrusteeAssignments } from '@/trustees/modals/UseTrusteeAssignments';
import createApi2 from '@/lib/Api2Factory';
import { AttorneyUser } from '@common/cams/users';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import AttorneyAssignmentSection from './AttorneyAssignmentSection';
import AuditorAssignmentSection from './AuditorAssignmentSection';
import ParalegalAssignmentSection from './ParalegalAssignmentSection';

interface TrusteeAssignedStaffProps {
  trusteeId: string;
}

export default function TrusteeAssignedStaff(props: Readonly<TrusteeAssignedStaffProps>) {
  const { trusteeId } = props;
  const { assignments, isLoading, error, getTrusteeOversightAssignments } = useTrusteeAssignments();
  const [attorneys, setAttorneys] = useState<AttorneyUser[]>([]);
  const [attorneysLoading, setAttorneysLoading] = useState<boolean>(true);
  const [attorneysError, setAttorneysError] = useState<string | null>(null);
  const api = createApi2();

  useEffect(() => {
    getTrusteeOversightAssignments(trusteeId);
  }, [trusteeId, getTrusteeOversightAssignments]);

  useEffect(() => {
    const loadAttorneys = async () => {
      setAttorneysLoading(true);
      setAttorneysError(null);
      try {
        const response = await api.getOversightStaff();
        setAttorneys(response.data ?? []);
      } catch {
        setAttorneysError('Failed to load attorneys');
      } finally {
        setAttorneysLoading(false);
      }
    };

    loadAttorneys();
  }, [api]);

  const refreshAssignments = () => {
    getTrusteeOversightAssignments(trusteeId);
  };

  return (
    <div className="right-side-screen-content">
      <div className="record-detail-container">
        {error && <Alert type={UswdsAlertStyle.Error}>{error}</Alert>}
        {attorneysError && <Alert type={UswdsAlertStyle.Error}>{attorneysError}</Alert>}

        <AttorneyAssignmentSection
          trusteeId={trusteeId}
          assignments={assignments}
          attorneys={attorneys}
          onAssignmentChange={refreshAssignments}
          isLoading={isLoading || attorneysLoading}
        />

        <AuditorAssignmentSection
          trusteeId={trusteeId}
          assignments={assignments}
          onAssignmentChange={refreshAssignments}
          isLoading={isLoading}
        />
      </div>
      <div className="record-detail-container">
        <ParalegalAssignmentSection
          trusteeId={trusteeId}
          assignments={assignments}
          onAssignmentChange={refreshAssignments}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
