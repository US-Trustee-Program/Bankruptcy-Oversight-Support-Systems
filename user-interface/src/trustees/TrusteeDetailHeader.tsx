import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { Trustee } from '@common/cams/trustees';

export interface TrusteeDetailHeaderProps {
  trustee: Trustee | null;
  isLoading: boolean;
  subHeading?: string;
}

export default function TrusteeDetailHeader({
  trustee,
  isLoading,
  subHeading,
}: Readonly<TrusteeDetailHeaderProps>) {
  return (
    <div className="trustee-detail-screen-heading">
      {(!trustee || isLoading) && (
        <div className="case-detail-header display-flex flex-align-center">
          <h1 className="text-no-wrap display-inline-block margin-right-1">Trustee Details</h1>
          <LoadingSpinner />
        </div>
      )}
      {!!trustee && !isLoading && (
        <>
          <div className="case-detail-header display-flex flex-align-center">
            <h1 className="text-no-wrap display-inline-block margin-right-1">{trustee.name}</h1>
          </div>
          {subHeading && (
            <div>
              <h2>{subHeading}</h2>
            </div>
          )}
        </>
      )}
    </div>
  );
}
