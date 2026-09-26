import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import TrusteePerformanceReportCard from './TrusteePerformanceReportCard';

export interface Chapter7PanelTrusteePerformanceReportCardProps {
  trusteeId: string;
  appointmentId: string;
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
  tprDisplayUpdates: boolean;
}

export default function Chapter7PanelTrusteePerformanceReportCard(
  props: Readonly<Chapter7PanelTrusteePerformanceReportCardProps>,
) {
  return <TrusteePerformanceReportCard {...props} variant="chapter7-panel" />;
}
