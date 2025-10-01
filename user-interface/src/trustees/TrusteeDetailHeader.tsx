import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Tag, { UswdsTagStyle } from '@/lib/components/uswds/Tag';
import { Trustee, formatChapterType } from '@common/cams/trustees';

export interface TrusteeDetailHeaderProps {
  trustee: Trustee | null;
  isLoading: boolean;
  districtLabels: string[];
  subHeading?: string;
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

export default function TrusteeDetailHeader({
  trustee,
  isLoading,
  districtLabels,
  subHeading,
}: TrusteeDetailHeaderProps) {
  return (
    <div className="trustee-detail-screen-heading">
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
            <h2>{subHeading}</h2>
          </div>
        </>
      )}
    </div>
  );
}
