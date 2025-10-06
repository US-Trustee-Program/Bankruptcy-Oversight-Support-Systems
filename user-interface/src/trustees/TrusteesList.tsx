import './TrusteesList.scss';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Trustee } from '@common/cams/trustees';
import { CourtDivisionDetails } from '@common/cams/courts';
import useApi2 from '@/lib/hooks/UseApi2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';

// Chapter type labels mapping - matches TrusteeCreateForm
const CHAPTER_LABELS: Record<string, string> = {
  '7-panel': '7 - Panel',
  '7-non-panel': '7 - Non-Panel',
  '11': '11',
  '11-subchapter-v': '11 - Subchapter V',
  '12': '12',
  '13': '13',
};

export default function TrusteesList() {
  const [trustees, setTrustees] = useState<Trustee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courtMap, setCourtMap] = useState<Map<string, string>>(new Map());
  const api = useApi2();

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getTrustees(), api.getCourts()])
      .then(([trusteesResponse, courtsResponse]) => {
        setTrustees(trusteesResponse.data || []);

        // Process court information to create a mapping
        if (courtsResponse?.data) {
          const courtMapping = new Map<string, string>();
          courtsResponse.data.forEach((court: CourtDivisionDetails) => {
            const label = `${court.courtName} (${court.courtDivisionName})`;
            courtMapping.set(court.courtDivisionCode, label);
          });
          setCourtMap(courtMapping);
        }

        setError(null);
      })
      .catch(() => {
        setError('Failed to load trustees. Please try again later.');
        setTrustees([]);
      })
      .finally(() => setLoading(false));
  }, [api]);

  // Helper function to format trustee status in title case
  function formatTrusteeStatus(status: string): string {
    if (status === 'not active') {
      return 'Not Active';
    }
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }

  // Helper function to format chapter types with proper labels
  function formatChapterTypes(chapters: string[] | undefined): React.ReactNode {
    if (!chapters || chapters.length === 0) {
      return 'No chapters assigned';
    }

    const readableChapters = chapters
      .map((chapter) => CHAPTER_LABELS[chapter] || chapter) // Fall back to original value if not found
      .sort();

    return readableChapters.map((chapter, index) => (
      <span key={chapter} className="text-no-wrap">
        {chapter}
        {index < readableChapters.length - 1 && ', '}
      </span>
    ));
  }

  // Helper function to convert district codes to readable names
  function formatDistricts(districts: string[] | undefined): string {
    if (!districts || districts.length === 0) {
      return 'No districts assigned';
    }

    const readableDistricts = districts
      .map((code) => courtMap.get(code) || code) // Fall back to code if not found
      .sort();

    return readableDistricts.join(', ');
  }

  if (loading) {
    return <LoadingSpinner caption="Loading trustees..." />;
  }

  if (error) {
    return (
      <div className="usa-alert usa-alert--error" role="alert">
        <div className="usa-alert__body">
          <h3 className="usa-alert__heading">Error loading trustees</h3>
          <p className="usa-alert__text">{error}</p>
        </div>
      </div>
    );
  }

  if (trustees.length === 0) {
    return (
      <div className="usa-alert usa-alert--info" role="alert">
        <div className="usa-alert__body">
          <h3 className="usa-alert__heading">No trustees found</h3>
          <p className="usa-alert__text">
            No trustee profiles have been created yet. Click &ldquo;Add New Trustee&rdquo; to create
            the first one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="trustees-list">
      <table className="usa-table usa-table--borderless" data-testid="trustees-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Court Districts</th>
            <th scope="col">Chapter Types</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {trustees.map((trustee) => (
            <tr key={trustee.trusteeId}>
              <td className="trustee-name">
                <NavLink
                  to={`/trustees/${trustee.trusteeId}`}
                  data-testid={`trustee-link-${trustee.trusteeId}`}
                  className="usa-link"
                >
                  {trustee.name}
                </NavLink>
              </td>
              <td className="trustee-districts">{formatDistricts(trustee.districts)}</td>
              <td className="trustee-chapters">{formatChapterTypes(trustee.chapters)}</td>
              <td className="trustee-status">{formatTrusteeStatus(trustee.status || 'active')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
