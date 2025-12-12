import './TrusteesList.scss';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Trustee } from '@common/cams/trustees';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';

export default function TrusteesList() {
  const [trustees, setTrustees] = useState<Trustee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrustees = () => {
      setLoading(true);
      Api2.getTrustees()
        .then((trusteesResponse) => {
          setTrustees(trusteesResponse.data || []);
          setError(null);
        })
        .catch(() => {
          setError('Failed to load trustees. Please try again later.');
          setTrustees([]);
        })
        .finally(() => setLoading(false));
    };

    fetchTrustees();
  }, []);

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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
