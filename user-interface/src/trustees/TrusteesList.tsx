import './TrusteesList.scss';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { TrusteeListItem } from '@common/cams/trustees';
import { formatChapterType, formatAppointmentType } from '@common/cams/trustees';
import { formatAppointmentStatus } from '@common/cams/trustee-appointments';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';

const COLUMN_HEADERS = ['Name', 'District (Division)', 'Chapter', 'Type', 'Status'];

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
      <div
        className="trustees-list-grid"
        role="table"
        aria-label="Trustees"
        data-testid="trustees-table"
      >
        <div role="rowgroup">
          <div className="trustees-list-header grid-row grid-gap-lg" role="row">
            {COLUMN_HEADERS.map((header) => (
              <div
                key={header}
                className="trustees-list-cell grid-col text-no-wrap"
                role="columnheader"
              >
                {header}
              </div>
            ))}
          </div>
        </div>
        <div role="rowgroup">
          {trustees.map((trustee) => {
            const rows = trustee.appointments.length === 0 ? [null] : trustee.appointments;

            return rows.map((appt, idx) => (
              <div
                key={`${trustee.trusteeId}-${idx}`}
                className={`trustees-list-row grid-row grid-gap-lg${idx === 0 ? ' trustee-group-start' : ''}`}
                role="row"
              >
                <div
                  className="trustees-list-cell grid-col"
                  role="cell"
                  data-cell={COLUMN_HEADERS[0]}
                >
                  {idx === 0 ? (
                    <NavLink
                      to={`/trustees/${trustee.trusteeId}`}
                      data-testid={`trustee-link-${trustee.trusteeId}`}
                      className="usa-link"
                    >
                      {trustee.name}
                    </NavLink>
                  ) : (
                    <span className="trustee-name-repeat" aria-hidden="true">
                      {trustee.name}
                    </span>
                  )}
                </div>
                <div
                  className="trustees-list-cell grid-col"
                  role="cell"
                  data-cell={COLUMN_HEADERS[1]}
                >
                  {appt ? formatDistrict(appt) : ''}
                </div>
                <div
                  className="trustees-list-cell grid-col"
                  role="cell"
                  data-cell={COLUMN_HEADERS[2]}
                >
                  {appt ? formatChapterType(appt.chapter) : ''}
                </div>
                <div
                  className="trustees-list-cell grid-col"
                  role="cell"
                  data-cell={COLUMN_HEADERS[3]}
                >
                  {appt ? formatAppointmentType(appt.appointmentType) : ''}
                </div>
                <div
                  className="trustees-list-cell grid-col"
                  role="cell"
                  data-cell={COLUMN_HEADERS[4]}
                >
                  {appt ? formatAppointmentStatus(appt.status) : ''}
                </div>
              </div>
            ));
          })}
        </div>
      </div>
    </div>
  );
}
