import { Trustee } from '@common/cams/trustees';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import Icon from '@/lib/components/uswds/Icon';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { formatChapterType } from '@/lib/utils/chapters';

export interface TrusteeDetailProfileProps {
  trustee: Trustee;
  districtLabels: string[];
  onEditPublicProfile: () => void;
  onEditInternalProfile: () => void;
}

export default function TrusteeDetailProfile({
  trustee,
  districtLabels,
  onEditPublicProfile,
  onEditInternalProfile,
}: TrusteeDetailProfileProps) {
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
            <div>
              {trustee.public?.address && (
                <>
                  <div data-testid="trustee-street-address">{trustee.public.address.address1}</div>
                  <div data-testid="trustee-street-address-line-2">
                    {trustee.public.address.address2}
                  </div>
                  <div data-testid="trustee-street-address-line-3">
                    {trustee.public.address.address3}
                  </div>
                  <span data-testid="trustee-city">{trustee.public.address.city}</span>
                  <span data-testid="trustee-state">, {trustee.public.address.state}</span>
                  <span data-testid="trustee-zip-code"> {trustee.public.address.zipCode}</span>
                </>
              )}
            </div>
            {trustee.public?.phone && (
              <div data-testid="trustee-phone-number">
                {trustee.public.phone.number}
                {trustee.public.phone.extension ? ` x${trustee.public.phone.extension}` : ''}
              </div>
            )}
            {trustee.public?.email && (
              <div data-testid="trustee-email" aria-label="trustee email">
                <a href={`mailto:${trustee.public.email}`}>
                  {trustee.public.email}
                  <Icon className="link-icon" name="mail_outline" />
                </a>
              </div>
            )}
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
              <>
                <div>
                  {trustee.internal?.address && (
                    <>
                      <div data-testid="trustee-internal-street-address">
                        {trustee.internal.address.address1}
                      </div>
                      <div data-testid="trustee-internal-street-address-two">
                        {trustee.internal.address.address2}
                      </div>
                      <span data-testid="trustee-internal-city">
                        {trustee.internal.address.city}
                      </span>
                      <span data-testid="trustee-internal-state">
                        , {trustee.internal.address.state}
                      </span>
                      <span data-testid="trustee-internal-zip-code">
                        {' '}
                        {trustee.internal.address.zipCode}
                      </span>
                    </>
                  )}
                </div>
                {trustee.internal?.phone && (
                  <div data-testid="trustee-internal-phone-number">
                    {trustee.internal.phone.number}
                    {trustee.internal.phone.extension
                      ? ` x${trustee.internal.phone.extension}`
                      : ''}
                  </div>
                )}
                {trustee.internal?.email && (
                  <div data-testid="trustee-email" aria-label="trustee email">
                    <a href={`mailto:${trustee.internal.email}`}>
                      {trustee.internal.email}
                      <Icon className="link-icon" name="mail_outline" />
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
