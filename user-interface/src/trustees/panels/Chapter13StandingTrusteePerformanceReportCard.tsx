import { useNavigate } from 'react-router-dom';
import { TrusteeUpcomingKeyDates, isoToMMDDYYYY } from '@common/cams/trustee-upcoming-key-dates';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import Chapter13StandingKeyDatesCard from './Chapter13StandingKeyDatesCard';
import Tag, { UswdsTagStyle } from '@/lib/components/uswds/Tag';
import {
  tprReviewPeriodField,
  tprFrequencyField,
  tprDueField,
} from './upcomingKeyDatesFieldConfig';

export interface Chapter13StandingTrusteePerformanceReportCardProps {
  trusteeId: string;
  appointmentId: string;
  appointmentHeading?: string;
  data: TrusteeUpcomingKeyDates | null;
}

const NO_DATE = 'No date added';

export default function Chapter13StandingTrusteePerformanceReportCard(
  props: Readonly<Chapter13StandingTrusteePerformanceReportCardProps>,
) {
  const { trusteeId, appointmentId, appointmentHeading, data } = props;
  const navigate = useNavigate();
  const session = LocalStorage.getSession();
  const canManage = !!session?.user?.roles?.includes(CamsRole.TrusteeAdmin);

  function openEdit() {
    navigate(
      `/trustees/${trusteeId}/appointments/${appointmentId}/chapter13-standing-tpr-key-dates/edit`,
      { state: { subHeading: appointmentHeading ?? '' } },
    );
  }

  const tag =
    data?.tprCompletionYear && data?.tprCompletionStatus ? (
      data.tprCompletionStatus === 'Complete' ? (
        <Tag id="tpr-completion-status" uswdsStyle={UswdsTagStyle.Green}>
          Complete for {data.tprCompletionYear}
        </Tag>
      ) : (
        <Tag id="tpr-completion-status" style={{ backgroundColor: '#B50909', color: 'white' }}>
          Incomplete for {data.tprCompletionYear}
        </Tag>
      )
    ) : undefined;

  const reviewPeriod = tprReviewPeriodField(data, 'TPR Review Period');
  const frequency = tprFrequencyField(data);
  const due = tprDueField(data, 'TPR Due');

  return (
    <Chapter13StandingKeyDatesCard
      title="Trustee Performance Report"
      tag={tag}
      onEdit={canManage ? openEdit : undefined}
      editAriaLabel="Edit Trustee Performance Report key dates"
      editTitle="Edit Trustee Performance Report key dates"
      testId="chapter13-standing-tpr-card"
      fields={[
        { label: reviewPeriod.label, value: reviewPeriod.value, testId: reviewPeriod.testId },
        { label: frequency.label, value: frequency.value, testId: frequency.testId },
        { label: due.label, value: due.value, testId: due.testId },
        {
          label: 'Last TPR Submitted',
          value: data?.pastTprSubmission ? isoToMMDDYYYY(data.pastTprSubmission) : NO_DATE,
          testId: 'last-tpr-submitted-row',
        },
      ]}
    />
  );
}
