import CommsLink from '@/lib/components/cams/CommsLink/CommsLink';
import { formatMeetingId } from '@/lib/utils/zoomInfo';
import { Trustee } from '@common/cams/trustees';

export interface TrusteeZoomInfoProps {
  trusteeId?: string | null;
  trustee: Trustee | null;
  loading: boolean;
}

/**
 * Displays 341 meeting information (Zoom link, phone, meeting ID, passcode) for a trustee.
 * Shows loading state, empty state, or full Zoom info based on data availability.
 */
export function TrusteeZoomInfo({ trusteeId, trustee, loading }: TrusteeZoomInfoProps) {
  if (!trusteeId) return null;

  if (loading) {
    return <div data-testid="case-detail-zoom-loading">Loading 341 meeting info...</div>;
  }

  if (!trustee || !trustee.zoomInfo) {
    return <div data-testid="case-detail-zoom-empty">No 341 meeting information</div>;
  }

  const { zoomInfo } = trustee;

  return (
    <div data-testid="case-detail-zoom-info" className="case-detail-zoom-info">
      <h4>341 Meeting</h4>
      <div data-testid="case-detail-zoom-link">
        <CommsLink contact={{ website: zoomInfo.link }} mode="website" label="Zoom Link" />
      </div>
      <div data-testid="case-detail-zoom-phone">
        <CommsLink contact={{ phone: { number: zoomInfo.phone } }} mode="phone-dialer" />
      </div>
      <div data-testid="case-detail-zoom-meeting-id">
        Meeting ID: {formatMeetingId(zoomInfo.meetingId)}
      </div>
      <div data-testid="case-detail-zoom-passcode">Passcode: {zoomInfo.passcode}</div>
    </div>
  );
}
