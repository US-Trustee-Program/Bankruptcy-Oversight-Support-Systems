import './TrusteesList.scss';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { TrusteeListItem } from '@common/cams/trustees';
import { formatChapterType, formatAppointmentType } from '@common/cams/trustees';
import { formatAppointmentStatus } from '@common/cams/trustee-appointments';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';

function formatDistrict(appointment: TrusteeListItem['appointments'][number]): string {
  const name = appointment.courtName ?? appointment.courtId;
  const division = appointment.courtDivisionName ?? appointment.divisionCode;
  return division ? `${name} (${division})` : name;
}

export default function TrusteesList() {
  const [trustees, setTrustees] = useState<TrusteeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrustees = () => {
      setLoading(true);
      Api2.getTrustees()
        .then((trusteesResponse) => {
          setTrustees(trusteesResponse.data ?? []);
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
      <p>{trustees.length} Trustee(s)</p>
      <table className="usa-table usa-table--borderless" data-testid="trustees-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">District (Division)</th>
            <th scope="col">Chapter</th>
            <th scope="col">Type</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {trustees.map((trustee) => {
            const rowCount = Math.max(1, trustee.appointments.length);
            return trustee.appointments.length === 0 ? (
              <tr key={trustee.trusteeId}>
                <td className="trustee-name" rowSpan={1}>
                  <NavLink
                    to={`/trustees/${trustee.trusteeId}`}
                    data-testid={`trustee-link-${trustee.trusteeId}`}
                    className="usa-link"
                  >
                    {trustee.name}
                  </NavLink>
                </td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            ) : (
              trustee.appointments.map((appt, idx) => (
                <tr key={`${trustee.trusteeId}-${idx}`}>
                  {idx === 0 && (
                    <td className="trustee-name" rowSpan={rowCount}>
                      <NavLink
                        to={`/trustees/${trustee.trusteeId}`}
                        data-testid={`trustee-link-${trustee.trusteeId}`}
                        className="usa-link"
                      >
                        {trustee.name}
                      </NavLink>
                    </td>
                  )}
                  <td>{formatDistrict(appt)}</td>
                  <td>{formatChapterType(appt.chapter)}</td>
                  <td>{formatAppointmentType(appt.appointmentType)}</td>
                  <td>{formatAppointmentStatus(appt.status)}</td>
                </tr>
              ))
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
