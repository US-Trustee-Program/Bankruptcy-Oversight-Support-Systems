import { Trustee, formatChapterType } from '@common/cams/trustees';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import FormattedContact from '@/lib/components/cams/FormattedContact';

export interface TrusteeDetailProfileProps {
  trustee: Trustee;
  districtLabels: string[];
  onEditPublicProfile: () => void;
  onEditInternalProfile: () => void;
  onEditOtherInformation: () => void;
}

export default function TrusteeDetailProfile({
  trustee,
  districtLabels,
  onEditPublicProfile,
  onEditInternalProfile,
  onEditOtherInformation,
}: Readonly<TrusteeDetailProfileProps>) {
  return (
    <div className="right-side-screen-content">
      <div className="record-detail-container">
        <div className="record-detail-card-list">
          <div className="trustee-contact-information record-detail-card">
            <div className="title-bar">
              <h3>Trustee Overview (Public)</h3>
              <Button
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
            <div data-testid="trustee-districts" aria-label="districts">
              <ul>
                {districtLabels.map((label, index) => (
                  <li key={index}>{label}</li>
                ))}
              </ul>
            </div>
            <div data-testid="trustee-chapters">
              <span>Chapter{trustee.chapters && trustee.chapters.length > 1 && 's'}: </span>
              {trustee.chapters?.map(formatChapterType).join(', ')}
            </div>
            <div className="trustee-status">Status: {trustee.status}</div>
          </div>
          <div className="trustee-other-information record-detail-card">
            <div className="title-bar">
              <h3>Other Information</h3>
              <Button
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label="Edit other trustee information"
                title="Edit other trustee information"
                onClick={onEditOtherInformation}
              >
                <IconLabel icon="edit" label="Edit" />
              </Button>
            </div>
            {trustee.software && (
              <div className="trustee-software">Software: {trustee.software}</div>
            )}
            {trustee.banks &&
              trustee.banks.length > 0 &&
              trustee.banks.map((bank, index) => (
                <div key={index} className="trustee-bank">
                  Bank: {bank}
                </div>
              ))}
            {!trustee.software && (!trustee.banks || trustee.banks.length === 0) && (
              <div>No information has been entered.</div>
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
                uswdsStyle={UswdsButtonStyle.Unstyled}
                aria-label="Edit trustee internal contact information"
                title="Edit trustee contact information"
                onClick={onEditInternalProfile}
              >
                <IconLabel icon="edit" label="Edit" />
              </Button>
            </div>
            {!trustee.internal && <div>No information added.</div>}
            {!!trustee.internal && (
              <FormattedContact contact={trustee.internal} testIdPrefix="trustee-internal" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
