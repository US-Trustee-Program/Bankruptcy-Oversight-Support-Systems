import './MeetingOfCreditorsInfoCard.scss';
import { ZoomInfo } from '@common/cams/trustees';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import { formatMeetingId } from '@/lib/utils/zoomInfo';
import { copyStringToClipboard } from '@/lib/utils/clipBoard';
import Icon from '@/lib/components/uswds/Icon';

interface ZoomInfoCardProps {
  zoomInfo?: ZoomInfo;
  onEdit: () => void;
}

export default function MeetingOfCreditorsInfoCard({
  zoomInfo,
  onEdit,
}: Readonly<ZoomInfoCardProps>) {
  return (
    <div className="trustee-zoom-information record-detail-card" data-testid="zoom-info-card">
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
          <div className="zoom-link">
            <a
              href={zoomInfo.link}
              target="_blank"
              rel="noopener noreferrer"
              className="usa-link comms-link"
              data-testid="zoom-link"
            >
              <IconLabel icon="launch" label="Zoom Link" location="left" />
            </a>
            <Button
              id="copy-zoom-link"
              className="cams-icon-label"
              uswdsStyle={UswdsButtonStyle.Unstyled}
              aria-label="Copy Zoom link"
              title="Copy Zoom link"
              onClick={() => copyStringToClipboard(zoomInfo.link)}
            >
              <Icon name="content_copy" />
            </Button>
          </div>
          <div className="zoom-phone" data-testid="zoom-phone">
            <a href={`tel:${zoomInfo.phone}`} className="usa-link comms-link">
              <IconLabel icon="phone" label={zoomInfo.phone} location="left" />
            </a>
          </div>
          <div className="zoom-meeting-id" data-testid="zoom-meeting-id">
            Meeting ID: {formatMeetingId(zoomInfo.meetingId)}
          </div>
          <div className="zoom-passcode" data-testid="zoom-passcode">
            Passcode: {zoomInfo.passcode}
          </div>
        </div>
      )}
    </div>
  );
}
