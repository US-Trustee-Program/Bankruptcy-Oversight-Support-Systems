import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import EditableTableCard from '@/lib/components/cams/EditableTableCard/EditableTableCard';
import { TrusteeUpcomingKeyDates, isoToMMDDYYYY } from '@common/cams/trustee-upcoming-key-dates';

export interface Chapter7PanelOtherKeyDatesCardProps {
  trusteeId: string;
  appointmentId: string;
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
}

const NO_DATE = 'No date added';

function formatDateOrDefault(isoDate: string | undefined): string {
  return isoDate ? isoToMMDDYYYY(isoDate) : NO_DATE;
}

export default function Chapter7PanelOtherKeyDatesCard(
  props: Readonly<Chapter7PanelOtherKeyDatesCardProps>,
) {
  const { appointmentId, data, isLoading } = props;

  if (isLoading) {
    return <LoadingSpinner id="chapter7-panel-other-key-dates-loading" />;
  }

  return (
    <EditableTableCard
      id={`chapter7-panel-other-key-dates-${appointmentId}`}
      title="Other"
      testId="chapter7-panel-other-key-dates-card"
      className="chapter7-panel-other-key-dates-card"
      tableId={`chapter7-panel-other-key-dates-table-${appointmentId}`}
      tableClassName="chapter7-panel-other-key-dates-table"
      tableAriaLabel="Other key dates"
      columns={[
        {
          key: 'lastBackgroundQuestionnaire',
          header: 'Last Update to Background Questionnaire',
          testId: 'past-background-question-row',
        },
      ]}
      values={{
        lastBackgroundQuestionnaire: formatDateOrDefault(data?.pastBackgroundQuestion),
      }}
    />
  );
}
