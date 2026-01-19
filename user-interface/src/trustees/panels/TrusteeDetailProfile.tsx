import { Trustee } from '@common/cams/trustees';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import FormattedContact from '@/lib/components/cams/FormattedContact';
import MeetingOfCreditorsInfoCard from './MeetingOfCreditorsInfoCard';

export interface TrusteeDetailProfileProps {
  trustee: Trustee;
  onEditPublicProfile: () => void;
  onEditInternalProfile: () => void;
  onEditOtherInformation: () => void;
  onEditZoomInfo: () => void;
}

export default function TrusteeDetailProfile({
  trustee,
  onEditPublicProfile,
  onEditInternalProfile,
  onEditOtherInformation,
  onEditZoomInfo,
}: Readonly<TrusteeDetailProfileProps>) {
  return (
    <div className="right-side-screen-content">
      <div className="record-detail-container">
        <div className="record-detail-card-list">
          <div className="trustee-contact-information record-detail-card">
            <div className="title-bar">
              <h3>Trustee Overview (Public)</h3>
              <Button
                id="edit-public-profile"
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label="Edit trustee public overview information"
                title="Edit trustee contact information"
                onClick={onEditPublicProfile}
              >
                <IconLabel icon="edit" label="Edit" />
              </Button>
            </div>
            <div className="trustee-name">{trustee.name}</div>
            <FormattedContact contact={trustee.public} testIdPrefix="trustee" />
          </div>
          <MeetingOfCreditorsInfoCard zoomInfo={trustee.zoomInfo} onEdit={onEditZoomInfo} />
          <div className="trustee-other-information record-detail-card">
            <div className="title-bar">
              <h3>Other Information</h3>
              <Button
                id="edit-other-information"
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label="Edit other trustee information"
                title="Edit other trustee information"
                onClick={onEditOtherInformation}
              >
                <IconLabel icon="edit" label="Edit" />
              </Button>
            </div>
            {trustee.banks &&
              trustee.banks.length > 0 &&
              trustee.banks.map((bank, index) => (
                <div key={index} className="trustee-bank" data-testid={`trustee-bank-${index}`}>
                  Bank: {bank}
                </div>
              ))}
            {trustee.software && (
              <div className="trustee-software" data-testid="trustee-software">
                Software: {trustee.software}
              </div>
            )}
            {!trustee.software && (!trustee.banks || trustee.banks.length === 0) && (
              <div data-testid="no-other-information">No information has been entered.</div>
            )}
          </div>
        </div>
        <div className="record-detail-card-list">
          <Alert
            message={'USTP Internal information is for internal use only.'}
            slim={true}
            role={'status'}
            inline={true}
            show={true /*!!trustee.internal*/}
            type={UswdsAlertStyle.Warning}
          ></Alert>
          <div className="trustee-internal-contact-information record-detail-card">
            <div className="title-bar">
              <h3>Contact Information (USTP Internal)</h3>
              <Button
                id="edit-internal-profile"
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label="Edit trustee internal contact information"
                title="Edit trustee contact information"
                onClick={onEditInternalProfile}
              >
                <IconLabel icon="edit" label="Edit" />
              </Button>
            </div>
            {!trustee.internal && (
              <div data-testid="no-internal-information">No information added.</div>
            )}
            {!!trustee.internal && (
              <FormattedContact contact={trustee.internal} testIdPrefix="trustee-internal" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
