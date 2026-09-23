import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';
import TrusteePerformanceReportCard from './TrusteePerformanceReportCard';

export interface Chapter12StandingTrusteePerformanceReportCardProps {
  trusteeId: string;
  appointmentId: string;
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
  tprDisplayUpdates: boolean;
}

export default function Chapter12StandingTrusteePerformanceReportCard(
  props: Readonly<Chapter12StandingTrusteePerformanceReportCardProps>,
) {
  return <TrusteePerformanceReportCard {...props} variant="chapter12-standing" />;
}
