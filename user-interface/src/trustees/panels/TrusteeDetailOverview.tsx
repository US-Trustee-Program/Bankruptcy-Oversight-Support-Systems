import '../TrusteeDetailScreen.scss';
import React from 'react';
import Icon from '@/lib/components/uswds/Icon';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { Trustee } from '@common/cams/trustees';

export interface TrusteeDetailOverviewProps {
  trustee: Trustee;
  districtLabels: string[];
  onEditPublicProfile: () => void;
  onEditInternalProfile: () => void;
}

export default function TrusteeDetailOverview({
  trustee,
  districtLabels,
  onEditPublicProfile,
  onEditInternalProfile,
}: TrusteeDetailOverviewProps) {
  function formatChapterType(chapter: string): React.ReactNode {
    const chapterLabels: Record<string, string> = {
      '7-panel': '7 - Panel',
      '7-non-panel': '7 - Non-Panel',
      '11': '11',
      '11-subchapter-v': '11 - Subchapter V',
      '12': '12',
      '13': '13',
    };
    return chapterLabels[chapter] || chapter;
  }

  return (
    <div className="cards-container">
      <div className="trustee-public-contact-information record-detail-card">
        <div className="title-bar">
          <h3>Public Contact Information</h3>
          <Button
            uswdsStyle={UswdsButtonStyle.Unstyled}
            aria-label="Edit trustee public contact information"
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
        <div className="trustee-districts">
          <span>Districts: </span>
          {districtLabels?.map((district, index) => {
            return (
              <span key={district}>
                {index > 0 && ', '}
                <span data-testid="trustee-district">{district}</span>
              </span>
            );
          })}
        </div>
        <div className="chapter-text">
          <span>Chapter types: </span>
          {trustee.chapters?.map((chapter: string, index: number) => {
            return (
              <span key={chapter}>
                {index > 0 && ', '}
                <span data-testid="trustee-chapter-types">{formatChapterType(chapter)}</span>
              </span>
            );
          })}
        </div>
        <div className="trustee-status">Status: {trustee.status}</div>
      </div>
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
                  <span data-testid="trustee-internal-city">{trustee.internal.address.city}</span>
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
                {trustee.internal.phone.extension ? ` x${trustee.internal.phone.extension}` : ''}
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
  );
}
