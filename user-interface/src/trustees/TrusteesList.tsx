import './TrusteesList.scss';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { TrusteeListItem } from '@common/cams/trustees';
import { formatChapterType, formatAppointmentType } from '@common/cams/trustees';
import { formatAppointmentStatus } from '@common/cams/trustee-appointments';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import TrusteeDistrictFilter from './filters/TrusteeDistrictFilter';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { TrusteeDistrictFilterRef } from './filters/trusteeDistrictFilter.types';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';

const COLUMN_HEADERS = ['Name', 'District (Division)', 'Chapter', 'Type', 'Status'];

function toColClass(header: string): string {
  return (
    'col-' +
    header
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  );
}

function formatDistrict(appointment: TrusteeListItem['appointments'][number]): string {
  const name = appointment.courtName ?? appointment.courtId;
  const division = appointment.courtDivisionName ?? appointment.divisionCode;
  return division ? `${name} (${division})` : name;
}

export default function TrusteesList() {
  const [trustees, setTrustees] = useState<TrusteeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDistricts, setSelectedDistricts] = useState<ComboOption[]>([]);
  const filterRef = useRef<TrusteeDistrictFilterRef>(null);
  const pageLoadStart = useRef(performance.now());

  useEffect(() => {
    const fetchTrustees = () => {
      setLoading(true);
      Api2.getTrustees()
        .then((trusteesResponse) => {
          const data = trusteesResponse.data ?? [];
          setTrustees(data);
          setError(null);
          getAppInsights().appInsights.trackEvent(
            { name: 'Trustee List Loaded' },
            {
              trusteeCount: data.length,
              loadMs: performance.now() - pageLoadStart.current,
            },
          );
        })
        .catch(() => {
          setError('Failed to load trustees. Please try again later.');
          setTrustees([]);
        })
        .finally(() => setLoading(false));
    };

    fetchTrustees();
  }, []);

  const defaultDistrictsRef = useRef<ComboOption[]>([]);
  const isDefaultApplied = useRef(false);

  const handleFilterDistrict = (districts: ComboOption[]) => {
    if (!isDefaultApplied.current) {
      defaultDistrictsRef.current = districts;
      isDefaultApplied.current = true;
    }
    setSelectedDistricts(districts);
  };

  const { filteredTrustees, announcement } = useMemo(() => {
    if (selectedDistricts.length === 0) {
      return {
        filteredTrustees: trustees,
        announcement: `Showing all ${trustees.length} trustee(s)`,
      };
    }
    const selectedDivisionCodes = selectedDistricts.map((d) => d.value);
    const filtered = trustees.filter((trustee) =>
      trustee.appointments.some(
        (appt) => appt.divisionCode && selectedDivisionCodes.includes(appt.divisionCode),
      ),
    );
    const districtNames = selectedDistricts.map((d) => d.label).join(', ');
    return {
      filteredTrustees: filtered,
      announcement: `Showing ${filtered.length} trustee(s) in ${districtNames}`,
    };
  }, [trustees, selectedDistricts]);

  useEffect(() => {
    if (!isDefaultApplied.current) return;
    const defaults = defaultDistrictsRef.current;
    const isDefault =
      selectedDistricts.length === defaults.length &&
      selectedDistricts.every((d) => defaults.some((def) => def.value === d.value));
    getAppInsights().appInsights.trackEvent(
      { name: 'Trustee District Filter Changed' },
      { isDefault, selectedCount: selectedDistricts.length, resultCount: filteredTrustees.length },
    );
  }, [selectedDistricts, filteredTrustees]);

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
      <TrusteeDistrictFilter ref={filterRef} handleFilterDistrict={handleFilterDistrict} />
      <div role="status" aria-live="polite" aria-atomic="true" className="usa-sr-only">
        {announcement}
      </div>
      <p className="trustees-list-count">{filteredTrustees.length} Trustee(s)</p>
      <div
        className="trustees-list-grid"
        role="table"
        aria-label="Trustees"
        data-testid="trustees-table"
      >
        <div role="rowgroup">
          <div className="trustees-list-header" role="row">
            {COLUMN_HEADERS.map((header) => (
              <div
                key={header}
                className={`trustees-list-cell ${toColClass(header)}`}
                role="columnheader"
              >
                {header}
              </div>
            ))}
          </div>
        </div>
        <div role="rowgroup">
          {filteredTrustees.map((trustee) => {
            const rows = trustee.appointments.length === 0 ? [null] : trustee.appointments;

            return (
              <div key={trustee.trusteeId} className="trustee-group">
                {rows.map((appt, idx) => (
                  <div
                    key={`${trustee.trusteeId}-${idx}`}
                    className={`trustees-list-row${idx > 0 ? ' trustees-list-row--continuation' : ''}`}
                    role="row"
                  >
                    <div
                      className={`trustees-list-cell ${toColClass(COLUMN_HEADERS[0])}`}
                      role="cell"
                      {...(idx === 0 ? { 'data-cell': COLUMN_HEADERS[0] } : {})}
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
                        <span aria-hidden="true"></span>
                      )}
                    </div>
                    <div
                      className={`trustees-list-cell ${toColClass(COLUMN_HEADERS[1])}`}
                      role="cell"
                      data-cell={COLUMN_HEADERS[1]}
                    >
                      {appt ? formatDistrict(appt) : ''}
                    </div>
                    <div
                      className={`trustees-list-cell ${toColClass(COLUMN_HEADERS[2])}`}
                      role="cell"
                      data-cell={COLUMN_HEADERS[2]}
                    >
                      {appt ? formatChapterType(appt.chapter) : ''}
                    </div>
                    <div
                      className={`trustees-list-cell ${toColClass(COLUMN_HEADERS[3])}`}
                      role="cell"
                      data-cell={COLUMN_HEADERS[3]}
                    >
                      {appt ? formatAppointmentType(appt.appointmentType) : ''}
                    </div>
                    <div
                      className={`trustees-list-cell ${toColClass(COLUMN_HEADERS[4])}`}
                      role="cell"
                      data-cell={COLUMN_HEADERS[4]}
                    >
                      {appt ? formatAppointmentStatus(appt.status) : ''}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
