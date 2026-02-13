import './MeetingOfCreditorsInfoCard.scss';
import { ZoomInfo } from '@common/cams/trustees';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import { formatMeetingId } from '@/lib/utils/zoomInfo';
import { copyHTMLToClipboard } from '@/lib/utils/clipBoard';
import Icon from '@/lib/components/uswds/Icon';
import { formatPhoneNumber } from '@common/phone-helper';

interface ZoomInfoCardProps {
  zoomInfo?: ZoomInfo;
  onEdit: () => void;
}

export default function MeetingOfCreditorsInfoCard({
  zoomInfo,
  onEdit,
}: Readonly<ZoomInfoCardProps>) {
  return (
    <div
      className="trustee-meeting-of-creditors-information record-detail-card"
      data-testid="zoom-info-card"
    >
      <div className="title-bar">
        <h3 data-testid="zoom-info-heading">
          341 Meeting
          <Button
            id="edit-zoom-info"
            uswdsStyle={UswdsButtonStyle.Unstyled}
            aria-label="Edit 341 meeting information"
            title="Edit 341 meeting information"
            onClick={onEdit}
          >
            <IconLabel icon="edit" label="Edit" />
          </Button>
        </h3>
      </div>
      {!zoomInfo && <div data-testid="zoom-info-empty-message">No information added.</div>}
      {zoomInfo && (
        <div data-testid="zoom-info-content">
          <div className="zoom-link">
            <a
              href={zoomInfo.link}
              target="_blank"
              rel="noopener noreferrer"
              className="usa-link comms-link"
              data-testid="zoom-link"
              aria-label={`Zoom Link: ${zoomInfo.link}`}
            >
              <IconLabel icon="launch" label="Zoom Link" location="left" />
            </a>
            <span className="usa-sr-only">{`: ${zoomInfo.link}`}</span>
          </div>
          <div className="zoom-phone" data-testid="zoom-phone">
            <a
              href={`tel:${zoomInfo.phone}`}
              className="usa-link comms-link"
              aria-label={`Phone: ${zoomInfo.phone}`}
            >
              <IconLabel icon="phone" label={formatPhoneNumber(zoomInfo.phone)} location="left" />
            </a>
            <span className="usa-sr-only">{`: ${zoomInfo.phone}`}</span>
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
  );
}
