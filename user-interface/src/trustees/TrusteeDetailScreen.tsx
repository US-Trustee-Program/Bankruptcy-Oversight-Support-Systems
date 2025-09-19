import './TrusteeDetailScreen.scss';
import '@/styles/record-detail.scss';
import React, { useEffect, useState } from 'react';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Icon from '@/lib/components/uswds/Icon';
import useApi2 from '@/lib/hooks/UseApi2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { Trustee } from '@common/cams/trustees';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import Tag, { UswdsTagStyle } from '@/lib/components/uswds/Tag';
import Button, { UswdsButtonStyle } from '@/lib/components/uswds/Button';
import { IconLabel } from '@/lib/components/cams/IconLabel/IconLabel';
import { TrusteeFormState } from './TrusteeForm';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import CommsLink from '@/lib/components/cams/CommsLink/CommsLink';

export default function TrusteeDetailScreen() {
  const { trusteeId } = useParams();
  const [trustee, setTrustee] = useState<Trustee | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [districtLabels, setDistrictLabels] = useState<string[]>([]);

  const navigate = useNavigate();
  const location = useLocation();

  const globalAlert = useGlobalAlert();
  const api = useApi2();

  function openEditPublicProfile() {
    const state: TrusteeFormState = {
      trusteeId,
      trustee: trustee || undefined,
      cancelTo: location.pathname,
      action: 'edit',
      contactInformation: 'public',
    };
    navigate(`/trustees/${trusteeId}/edit`, { state });
  }

  function openEditInternalProfile() {
    const state: TrusteeFormState = {
      trusteeId,
      trustee: trustee || undefined,
      cancelTo: location.pathname,
      action: 'edit',
      contactInformation: 'internal',
    };
    navigate(`/trustees/${trusteeId}/edit`, { state });
  }

  function formatTrusteeStatusText(status: string): string {
    if (status === 'not active') {
      return 'Not Active';
    }
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }

  function formatTrusteeStatusColor(status: string): UswdsTagStyle {
    if (status === 'active') {
      return UswdsTagStyle.Green;
    } else if (status === 'suspended') {
      return UswdsTagStyle.SecondaryDark;
    }
    return UswdsTagStyle.BaseDarkest;
  }

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

  useEffect(() => {
    if (trusteeId) {
      setIsLoading(true);
      Promise.all([api.getTrustee(trusteeId), api.getCourts()])
        .then(([trusteeResponse, courtsResponse]) => {
          setTrustee(trusteeResponse.data);
          const trusteeDistricts: string[] = [];
          trusteeResponse.data.districts?.map((district: string) => {
            const court = courtsResponse.data.find((court) => court.courtDivisionCode === district);
            if (court) {
              trusteeDistricts.push(`${court.courtName} (${court.courtDivisionName})`);
            }
          });
          setDistrictLabels(trusteeDistricts);
        })
        .catch(() => {
          globalAlert?.error('Could not get trustee details');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [trusteeId]);

  return (
    <MainContent className="record-detail" data-testid="record-detail">
      <DocumentTitle name="Trustee Detail" />
      <div className="trustee-detail-screen" data-testid="trustee-detail-screen">
        {(!trustee || isLoading) && (
          <div className="record-detail-header display-flex flex-align-center">
            <h1 className="text-no-wrap display-inline-block margin-right-1">Trustee Details</h1>
            <LoadingSpinner />
          </div>
        )}
        {!!trustee && !isLoading && (
          <>
            <div className="record-detail-header display-flex flex-align-center">
              <h1 className="text-no-wrap display-inline-block margin-right-1">{trustee.name}</h1>
              <div className="tag-list">
                {trustee.status !== undefined && (
                  <Tag
                    uswdsStyle={formatTrusteeStatusColor(trustee.status)}
                    title="Trustee status"
                    id="trustee-status"
                  >
                    {formatTrusteeStatusText(trustee.status)}
                  </Tag>
                )}
                {trustee.districts &&
                  districtLabels.map((label, index) => (
                    <Tag
                      key={index}
                      uswdsStyle={UswdsTagStyle.Primary}
                      title="Court Name and District"
                      id={`district-${index}`}
                    >
                      {label}
                    </Tag>
                  ))}
                {trustee.chapters?.map((chapter, index) => (
                  <Tag
                    key={index}
                    uswdsStyle={UswdsTagStyle.Warm}
                    title="Chapter Type"
                    id={`chapter-${index}`}
                  >
                    Chapter {formatChapterType(chapter)}
                  </Tag>
                ))}
              </div>
            </div>
            <div>
              <h2>Trustee</h2>
            </div>
            <div className="record-detail-container">
              <div className="record-detail-card-list">
                <div className="trustee-contact-information record-detail-card">
                  <div className="title-bar">
                    <h3>Trustee Overview (Public)</h3>
                    <Button
                      uswdsStyle={UswdsButtonStyle.Unstyled}
                      aria-label="Edit trustee public overview information"
                      title="Edit trustee contact information"
                      onClick={openEditPublicProfile}
                    >
                      <IconLabel icon="edit" label="Edit" />
                    </Button>
                  </div>
                  <div className="trustee-name">{trustee.name}</div>
                  <div>
                    {trustee.public?.address && (
                      <>
                        <div data-testid="trustee-street-address">
                          {trustee.public.address.address1}
                        </div>
                        <div data-testid="trustee-street-address-line-2">
                          {trustee.public.address.address2}
                        </div>
                        <div data-testid="trustee-street-address-line-3">
                          {trustee.public.address.address3}
                        </div>
                        <span data-testid="trustee-city">{trustee.public.address.city}</span>
                        <span data-testid="trustee-state">, {trustee.public.address.state}</span>
                        <span data-testid="trustee-zip-code">
                          {' '}
                          {trustee.public.address.zipCode}
                        </span>
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
                      onClick={openEditInternalProfile}
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
                      {/*This div is for demonstration purposes only and should be removed.*/}
                      <div>
                        <CommsLink contact={trustee.internal} mode="teams-chat" />
                        <br />
                        <CommsLink contact={trustee.internal} mode="teams-call" />
                        <br />
                        <CommsLink contact={trustee.internal} mode="phone-dialer" />
                        <br />
                        <CommsLink contact={trustee.internal} mode="email" />
                        <br />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </MainContent>
  );
}
