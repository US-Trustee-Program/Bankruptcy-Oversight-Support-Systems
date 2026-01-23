import { ZoomInfo } from '@common/cams/trustees';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import { formatMeetingId } from '@/lib/utils/zoomInfo';
import { copyHTMLToClipboard } from '@/lib/utils/clipBoard';
import Icon from '@/lib/components/uswds/Icon';

interface ZoomInfoCardProps {
  zoomInfo?: ZoomInfo;
  onEdit: () => void;
}

function copyMeetingInfoToClipboard() {
  const meetingInfoContents: HTMLElement | null = document.querySelector<HTMLElement>(
    '.meeting-of-creditors-info-details',
  );
  if (meetingInfoContents) {
    copyHTMLToClipboard('meeting-of-creditors-info-details');
  }
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
      {!zoomInfo && (
        <div data-testid="zoom-info-empty-message">No information has been entered.</div>
      )}
      {zoomInfo && (
        <div data-testid="zoom-info-content">
          <div className="meeting-of-creditors-info-details">
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
                <IconLabel icon="phone" label="Phone" location="left" />
              </a>
              <span className="usa-sr-only">{`: ${zoomInfo.phone}`}</span>
            </div>
            <div className="zoom-meeting-id" data-testid="zoom-meeting-id">
              Meeting ID: {formatMeetingId(zoomInfo.meetingId)}
            </div>
            <div className="zoom-passcode" data-testid="zoom-passcode">
              Passcode: {zoomInfo.passcode}
            </div>
          </div>
          <Button
            id="copy-meeting-of-creditors-info"
            uswdsStyle={UswdsButtonStyle.Unstyled}
            aria-label="Copy Meeting of Creditors info"
            title="Copy Meeting of Creditors info"
            onClick={() => copyMeetingInfoToClipboard()}
          >
            <Icon name="content_copy" />
          </Button>
        </div>
      )}
    </div>
  );
}
