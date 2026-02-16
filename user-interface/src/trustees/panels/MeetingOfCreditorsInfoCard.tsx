import './MeetingOfCreditorsInfoCard.scss';
import { ZoomInfo } from '@common/cams/trustees';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import { formatMeetingId } from '@/lib/utils/zoomInfo';
import { copyHTMLToClipboard } from '@/lib/utils/clipBoard';
import Icon from '@/lib/components/uswds/Icon';
import { formatPhoneNumber } from '@common/phone-helper';
import CommsLink from '@/lib/components/cams/CommsLink/CommsLink';

interface ZoomInfoCardProps {
  zoomInfo?: ZoomInfo;
  onEdit: () => void;
}

export default function MeetingOfCreditorsInfoCard({
  zoomInfo,
  onEdit,
}: Readonly<ZoomInfoCardProps>) {
  return (
    <div className="meeting-of-creditors-card-container" data-testid="zoom-info-card">
      <div className="meeting-of-creditors-card usa-card">
        <div className="usa-card__container">
          <div className="usa-card__body">
            <div className="meeting-of-creditors-card-header">
              <h4 data-testid="zoom-info-heading">341 Meeting</h4>
              <Button
                id="edit-zoom-info"
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label="Edit 341 meeting information"
                title="Edit 341 meeting information"
                onClick={onEdit}
              >
                <IconLabel icon="edit" label="Edit" />
              </Button>
            </div>
            {!zoomInfo && <div data-testid="zoom-info-empty-message">No information added.</div>}
            {zoomInfo && (
              <div data-testid="zoom-info-content">
                <div className="zoom-link" data-testid="zoom-link">
                  <CommsLink
                    contact={{ website: zoomInfo.link }}
                    mode="website"
                    label="Zoom Link"
                  />
                </div>
                <div className="zoom-phone" data-testid="zoom-phone">
                  <CommsLink contact={{ phone: { number: zoomInfo.phone } }} mode="phone-dialer" />
                </div>
                <div className="zoom-meeting-id" data-testid="zoom-meeting-id">
                  Meeting ID: {formatMeetingId(zoomInfo.meetingId)}
                </div>
                <div className="zoom-passcode" data-testid="zoom-passcode">
                  Passcode: {zoomInfo.passcode}
                </div>
                <div id="meeting-of-creditors-info-copy" style={{ display: 'none' }}>
                  Zoom Link:{' '}
                  <a href={zoomInfo.link} target="_blank" rel="noopener noreferrer">
                    {zoomInfo.link}
                  </a>
                  <br />
                  Phone: <a href={`tel:${zoomInfo.phone}`}>{formatPhoneNumber(zoomInfo.phone)}</a>
                  <br />
                  Meeting ID: {formatMeetingId(zoomInfo.meetingId)}
                  <br />
                  Passcode: {zoomInfo.passcode}
                </div>
                <Button
                  id="copy-meeting-of-creditors-info"
                  uswdsStyle={UswdsButtonStyle.Outline}
                  aria-label="Copy Meeting of Creditors info"
                  title="Copy Meeting of Creditors info"
                  onClick={() => copyHTMLToClipboard('#meeting-of-creditors-info-copy')}
                >
                  <Icon name="content_copy" />
                  Copy Zoom Info
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
