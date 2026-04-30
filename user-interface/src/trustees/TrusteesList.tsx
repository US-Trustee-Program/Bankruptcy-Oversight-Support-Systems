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
import { sortTrusteeAppointments } from '@/lib/utils/court-utils';

const COLUMN_HEADERS = ['Name', 'District', 'Chapter', 'Type', 'Status'];

function filterTrustees(
  trustees: TrusteeListItem[],
  selectedDistricts: ComboOption[],
  selectedChapters: ComboOption[],
): TrusteeListItem[] {
  if (selectedDistricts.length === 0 && selectedChapters.length === 0) return trustees;
  const selectedDivisionCodes = new Set(selectedDistricts.flatMap((d) => d.value.split(',')));
  const selectedChapterValues = new Set(selectedChapters.map((c) => c.value));
  return trustees.filter((trustee) => {
    const districtMatch =
      selectedDistricts.length === 0 ||
      trustee.appointments.some(
        (appt) => appt.divisionCode && selectedDivisionCodes.has(appt.divisionCode),
      );
    const chapterMatch =
      selectedChapters.length === 0 ||
      trustee.appointments.some((appt) => selectedChapterValues.has(appt.chapter));
    return districtMatch && chapterMatch;
  });
}

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

export default function TrusteesList() {
  const [trustees, setTrustees] = useState<TrusteeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDistricts, setSelectedDistricts] = useState<ComboOption[]>([]);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedChapters, setSelectedChapters] = useState<ComboOption[]>([]);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');
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
  const isChapterFilterInteracted = useRef(false);

  const handleFilterDistrict = (districts: ComboOption[]) => {
    if (!isDefaultApplied.current) {
      defaultDistrictsRef.current = districts;
      isDefaultApplied.current = true;
    }
    setSelectedDistricts(districts);
  };

  const handleFilterChapter = (chapters: ComboOption[]) => {
    isChapterFilterInteracted.current = true;
    setSelectedChapters(chapters);
    setLiveAnnouncement('');
  };

  const { filteredTrustees } = useMemo(() => {
    const filtered = filterTrustees(trustees, selectedDistricts, selectedChapters);

    const sorted = [...filtered].sort((a, b) => {
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

    // Sort appointments within each trustee by state, region, chapter, and appointment type
    const sortedWithAppointments = sorted.map((trustee) => ({
      ...trustee,
      appointments: sortTrusteeAppointments(trustee.appointments),
    }));

    return {
      filteredTrustees: sortedWithAppointments,
    };
  }, [trustees, selectedDistricts, selectedChapters, sortDirection]);

  useEffect(() => {
    if (!isDefaultApplied.current) return;
    const defaults = defaultDistrictsRef.current;
    const isDefault =
      selectedDistricts.length === defaults.length &&
      selectedDistricts.every((d) => defaults.some((def) => def.value === d.value));

    const resultCount = filterTrustees(trustees, selectedDistricts, selectedChapters).length;

    getAppInsights().appInsights.trackEvent(
      { name: 'Trustee District Filter Changed' },
      {
        isDefault,
        selectedCount: selectedDistricts.length,
        resultCount,
        chapterCount: selectedChapters.length,
      },
    );
  }, [selectedDistricts, selectedChapters, trustees]);

  useEffect(() => {
    if (!isChapterFilterInteracted.current) return;
    setLiveAnnouncement(`${filteredTrustees.length} Trustees`);
  }, [filteredTrustees]);

  useEffect(() => {
    if (!isChapterFilterInteracted.current) return;

    const resultCount = filterTrustees(trustees, selectedDistricts, selectedChapters).length;

    getAppInsights().appInsights.trackEvent(
      { name: 'Trustee Chapter Filter Changed' },
      {
        selectedCount: selectedChapters.length,
        resultCount,
        districtCount: selectedDistricts.length,
        selectedChapterValues: selectedChapters.map((c) => c.value).join(','),
      },
    );
  }, [selectedChapters, selectedDistricts, trustees]);

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
        handleFilterChapter={handleFilterChapter}
      />
      <div role="status" aria-live="polite" aria-atomic="true" className="usa-sr-only">
        {liveAnnouncement}
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
                      ? () => {
                          const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                          setSortDirection(newDirection);
                          getAppInsights().appInsights.trackEvent(
                            { name: 'Trustee List Sort Changed' },
                            { sortDirection: newDirection },
                          );
                        }
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
