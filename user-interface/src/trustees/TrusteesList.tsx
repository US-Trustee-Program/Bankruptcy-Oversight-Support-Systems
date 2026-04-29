import './TrusteesList.scss';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { TrusteeDistrictFilterRef } from './filters/trusteeDistrictFilter.types';
import Icon from '@/lib/components/uswds/Icon';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';

const COLUMN_HEADERS = ['Name', 'District', 'Chapter', 'Type', 'Status'];

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
  return appointment.courtName ?? appointment.courtId;
}

function parseDistrictName(courtName: string): { state: string; region: string } {
  // Extract state: everything after "District of " or use entire name as fallback
  const districtOfMatch = courtName.match(/District of (.+)$/i);
  const state = districtOfMatch ? districtOfMatch[1] : courtName;

  // Extract region: everything before "District of" (e.g., "Southern", "Eastern", "Western", "Northern")
  const regionMatch = courtName.match(/^(.+?)\s+District of/i);
  const region = regionMatch ? regionMatch[1] : '';

  return { state, region };
}

export default function TrusteesList() {
  const [trustees, setTrustees] = useState<TrusteeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDistricts, setSelectedDistricts] = useState<ComboOption[]>([]);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
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
    const selectedDivisionCodes = selectedDistricts.flatMap((d) => d.value.split(','));
    const base =
      selectedDistricts.length === 0
        ? trustees
        : trustees.filter((t) =>
            t.appointments.some(
              (appt) => appt.divisionCode && selectedDivisionCodes.includes(appt.divisionCode),
            ),
          );

    // Sort trustees by last name
    const sorted = [...base].sort((a, b) => {
      const lastCmp = (a.lastName ?? '').localeCompare(b.lastName ?? '', undefined, {
        sensitivity: 'base',
      });
      const cmp =
        lastCmp !== 0
          ? lastCmp
          : (a.firstName ?? '').localeCompare(b.firstName ?? '', undefined, {
              sensitivity: 'base',
            });
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    // Sort appointments within each trustee by state, then region, then chapter
    const sortedWithAppointments = sorted.map((trustee) => ({
      ...trustee,
      appointments: [...trustee.appointments].sort((a, b) => {
        const districtA = a.courtName ?? a.courtId ?? '';
        const districtB = b.courtName ?? b.courtId ?? '';

        const { state: stateA, region: regionA } = parseDistrictName(districtA);
        const { state: stateB, region: regionB } = parseDistrictName(districtB);

        // First sort by state
        const stateCmp = stateA.localeCompare(stateB, undefined, { sensitivity: 'base' });
        if (stateCmp !== 0) return stateCmp;

        // Then sort by region (Western, Southern, Eastern, Northern, etc.)
        const regionCmp = regionA.localeCompare(regionB, undefined, { sensitivity: 'base' });
        if (regionCmp !== 0) return regionCmp;

        // Finally sort by chapter
        const chapterA = a.chapter ?? '';
        const chapterB = b.chapter ?? '';
        return chapterA.localeCompare(chapterB, undefined, { sensitivity: 'base' });
      }),
    }));

    const announcement =
      selectedDistricts.length === 0
        ? `Showing all ${trustees.length} trustee(s)`
        : `Showing ${base.length} trustee(s) in ${selectedDistricts.map((d) => d.label).join(', ')}`;

    return { filteredTrustees: sortedWithAppointments, announcement };
  }, [trustees, selectedDistricts, sortDirection]);

  useEffect(() => {
    if (!isDefaultApplied.current) return;
    const defaults = defaultDistrictsRef.current;
    const isDefault =
      selectedDistricts.length === defaults.length &&
      selectedDistricts.every((d) => defaults.some((def) => def.value === d.value));

    // Calculate result count inline to avoid dependency on filteredTrustees
    const selectedDivisionCodes = selectedDistricts.map((d) => d.value);
    const resultCount =
      selectedDistricts.length === 0
        ? trustees.length
        : trustees.filter((trustee) =>
            trustee.appointments.some(
              (appt) => appt.divisionCode && selectedDivisionCodes.includes(appt.divisionCode),
            ),
          ).length;

    getAppInsights().appInsights.trackEvent(
      { name: 'Trustee District Filter Changed' },
      { isDefault, selectedCount: selectedDistricts.length, resultCount },
    );
  }, [selectedDistricts, trustees]);

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
            {COLUMN_HEADERS.map((header) => {
              const isNameCol = header === 'Name';
              return (
                <div
                  key={header}
                  className={`trustees-list-cell ${toColClass(header)}${isNameCol ? ' sortable' : ''}`}
                  role="columnheader"
                  tabIndex={isNameCol ? 0 : undefined}
                  aria-sort={
                    isNameCol ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                  onClick={
                    isNameCol
                      ? () => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
                      : undefined
                  }
                  onKeyDown={
                    isNameCol
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
                          }
                        }
                      : undefined
                  }
                  style={isNameCol ? { cursor: 'pointer' } : undefined}
                >
                  {header}
                  {isNameCol && (
                    <Icon name={sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'} />
                  )}
                </div>
              );
            })}
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
