import './TrusteeDetailScreen.scss';
import '@/styles/record-detail.scss';
import React, { useEffect, useState } from 'react';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Icon from '@/lib/components/uswds/Icon';
import useApi2 from '@/lib/hooks/UseApi2';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import { Trustee } from '@common/cams/parties';
import { useParams } from 'react-router-dom';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import Tag, { UswdsTagStyle } from '@/lib/components/uswds/Tag';

export default function TrusteeDetailScreen() {
  const { trusteeId } = useParams();
  const [trustee, setTrustee] = useState<Trustee | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [districtLabels, setDistrictLabels] = useState<string[]>([]);

  const globalAlert = useGlobalAlert();
  const api = useApi2();

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
          trusteeResponse.data.districts?.map((district) => {
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
                {trustee.chapters &&
                  trustee.chapters.map((chapter, index) => (
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
            <div className="grid-col-12 tablet:grid-col-10 desktop:grid-col-8 record-detail-container">
              <div className="record-detail-card-list">
                <div className="trustee-contact-information record-detail-card">
                  <h3>Contact Information (Public)</h3>
                  <div className="trustee-name">{trustee.name}</div>
                  <div>
                    {trustee.address && (
                      <>
                        <div className="trustee-street-address">{trustee.address.address1}</div>
                        <span className="trustee-city">{trustee.address.city}</span>
                        <span className="trustee-state">, {trustee.address.state}</span>
                        <span className="trustee-zip-code"> {trustee.address.zipCode}</span>
                      </>
                    )}
                  </div>
                  <div className="trustee-phone-number">{trustee.phone}</div>
                  {trustee.email && (
                    <div data-testid="trustee-email" aria-label="trustee email">
                      <a href={`mailto:${trustee.email}`}>
                        {trustee.email}
                        <Icon className="link-icon" name="mail_outline" />
                      </a>
                    </div>
                  )}
                  <div className="trustee-districts" aria-label="districts">
                    <ul>
                      {districtLabels.map((label, index) => (
                        <li key={index}>{label}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="trustee-chapters">
                    <span>Chapter{trustee.chapters && trustee.chapters.length > 1 && 's'}: </span>
                    {trustee.chapters && trustee.chapters.map(formatChapterType).join(', ')}
                  </div>
                  <div className="trustee-status">Status: {trustee.status}</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </MainContent>
  );
}
