import './TrusteesList.scss';
import { useEffect, useMemo, useState, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { TrusteeListItem } from '@common/cams/trustees';
import {
  formatChapterType,
  formatAppointmentType,
  formatTrusteeListName,
} from '@common/cams/trustees';
import { formatAppointmentStatus } from '@common/cams/trustee-appointments';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import TrusteeDistrictFilter from './filters/TrusteeDistrictFilter';
import { ComboOption } from '@/lib/components/combobox/ComboBox';
import Icon from '@/lib/components/uswds/Icon';
import { TrusteeDistrictFilterRef } from './filters/trusteeDistrictFilter.types';

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
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const filterRef = useRef<TrusteeDistrictFilterRef>(null);

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

  const handleFilterDistrict = (districts: ComboOption[]) => {
    setSelectedDistricts(districts);
  };

  const handleExpandedChange = (isExpanded: boolean) => {
    setIsFilterExpanded(isExpanded);
  };

  const handleRemovePill = (district: ComboOption) => {
    filterRef.current?.removePill(district);
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
      <TrusteeDistrictFilter
        ref={filterRef}
        handleFilterDistrict={handleFilterDistrict}
        onExpandedChange={handleExpandedChange}
      />
      <div role="status" aria-live="polite" aria-atomic="true" className="usa-sr-only">
        {announcement}
      </div>
      {/* Pills shown when filter is expanded */}
      {isFilterExpanded && selectedDistricts.length > 0 && (
        <div className="filter-pills-container">
          {selectedDistricts.map((district) => (
            <span key={district.value} className="usa-tag filter-pill">
              {district.label}
              <button
                type="button"
                className="usa-tag__remove-button"
                onClick={() => handleRemovePill(district)}
                aria-label={`Remove ${district.label} filter`}
              >
                <Icon name="close" />
              </button>
            </span>
          ))}
        </div>
      )}
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
                  <div key={`${trustee.trusteeId}-${idx}`} className="trustees-list-row" role="row">
                    <div
                      className={`trustees-list-cell ${toColClass(COLUMN_HEADERS[0])}`}
                      role="cell"
                      data-cell={COLUMN_HEADERS[0]}
                    >
                      {idx === 0 ? (
                        <NavLink
                          to={`/trustees/${trustee.trusteeId}`}
                          data-testid={`trustee-link-${trustee.trusteeId}`}
                          className="usa-link"
                        >
                          {formatTrusteeListName(
                            trustee.firstName,
                            trustee.middleName,
                            trustee.lastName,
                            trustee.name,
                          )}
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
