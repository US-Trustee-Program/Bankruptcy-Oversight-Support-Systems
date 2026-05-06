import './TrusteesList.scss';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { TrusteeListItem } from '@common/cams/trustees';
import useDebounce from '@/lib/hooks/UseDebounce';
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
import {
  sortTrusteeAppointments,
  buildDivisionsDisplay,
  getDivisionsForDistrict,
  getDistrictDivisionComboOptions,
} from '@/lib/utils/court-utils';
import useFeatureFlags, { TRUSTEE_DISTRICT_DIVISION } from '@/lib/hooks/UseFeatureFlags';
import { CourtDivisionDetails } from '@common/cams/courts';

const BASE_COLUMN_HEADERS = ['Name', 'District', 'Chapter', 'Type', 'Status'];
const DIVISION_COLUMN_HEADERS = ['Name', 'District', 'Division', 'Chapter', 'Type', 'Status'];

function filterTrustees(
  trustees: TrusteeListItem[],
  selectedDistricts: ComboOption[],
  selectedChapters: ComboOption[],
  districtDivisionEnabled: boolean = false,
  selectedDivisions: ComboOption[] = [],
): TrusteeListItem[] {
  if (
    selectedDistricts.length === 0 &&
    selectedChapters.length === 0 &&
    selectedDivisions.length === 0
  )
    return trustees;
  const selectedChapterValues = new Set(selectedChapters.map((c) => c.value));
  return trustees.filter((trustee) => {
    let districtMatch: boolean;
    if (districtDivisionEnabled) {
      if (selectedDivisions.length > 0) {
        const courtFilter = new Map<string, Set<string>>();
        for (const opt of selectedDivisions) {
          const [courtId, code] = opt.value.split('|');
          if (!courtFilter.has(courtId)) courtFilter.set(courtId, new Set());
          courtFilter.get(courtId)!.add(code);
        }
        districtMatch = trustee.appointments.some((appt) => {
          const allowed = courtFilter.get(appt.courtId);
          if (!allowed) return false;
          if (allowed.has('ALL')) return true;
          if (!appt.divisionCodes || appt.divisionCodes.length === 0) return true;
          return appt.divisionCodes.some((code) => allowed.has(code));
        });
      } else if (selectedDistricts.length > 0) {
        const selectedCourtIds = new Set(selectedDistricts.map((d) => d.value));
        districtMatch = trustee.appointments.some((appt) => selectedCourtIds.has(appt.courtId));
      } else {
        districtMatch = true;
      }
    } else if (selectedDistricts.length === 0) {
      districtMatch = true;
    } else {
      const selectedDivisionCodes = new Set(selectedDistricts.flatMap((d) => d.value.split(',')));
      districtMatch = trustee.appointments.some(
        (appt) => appt.divisionCode && selectedDivisionCodes.has(appt.divisionCode),
      );
    }
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
  const [selectedDivisions, setSelectedDivisions] = useState<ComboOption[]>([]);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedChapters, setSelectedChapters] = useState<ComboOption[]>([]);
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');
  const [nameSearch, setNameSearch] = useState('');
  const [nameSearchIds, setNameSearchIds] = useState<Set<string>>(new Set());
  const [nameSearchLoading, setNameSearchLoading] = useState(false);
  const [allCourts, setAllCourts] = useState<CourtDivisionDetails[]>([]);
  const flags = useFeatureFlags();
  const districtDivisionEnabled = !!flags[TRUSTEE_DISTRICT_DIVISION];
  const COLUMN_HEADERS = districtDivisionEnabled ? DIVISION_COLUMN_HEADERS : BASE_COLUMN_HEADERS;
  const stableCountRef = useRef<number | null>(null);
  const filterRef = useRef<TrusteeDistrictFilterRef>(null);
  const pageLoadStart = useRef(performance.now());
  const isNameFilterInteracted = useRef(false);
  const previousNameSearchRef = useRef('');
  const nameSearchCountRef = useRef(0);
  const nameSearchStartRef = useRef<number | null>(null);
  const nameSearchQueryLengthRef = useRef(0);
  const debounce = useDebounce();

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
    setSelectedDivisions([]);
    setSelectedDistricts(districts);
  };

  const handleFilterDivision = (divisions: ComboOption[]) => {
    setSelectedDivisions(divisions);
  };

  const handleFilterChapter = (chapters: ComboOption[]) => {
    isChapterFilterInteracted.current = true;
    setSelectedChapters(chapters);
    setLiveAnnouncement('');
  };

  const handleFilterName = (name: string) => {
    isNameFilterInteracted.current = true;
    if (name.length >= 2) setNameSearchLoading(true);
    setNameSearch(name);
  };

  useEffect(() => {
    if (nameSearch.length < 2) {
      nameSearchQueryLengthRef.current = 0;
      setNameSearchIds(new Set());
      setNameSearchLoading(false);
      return;
    }
    nameSearchQueryLengthRef.current = nameSearch.length;
    setNameSearchLoading(true);
    debounce(async () => {
      const searchStart = performance.now();
      try {
        const response = await Api2.searchTrustees(nameSearch);
        nameSearchCountRef.current += 1;
        const ids = new Set(response.data.map((r) => r.trusteeId));
        nameSearchStartRef.current = performance.now() - searchStart;
        setNameSearchIds(ids);
      } catch {
        nameSearchStartRef.current = null;
        setNameSearch('');
        setNameSearchIds(new Set());
      } finally {
        setNameSearchLoading(false);
      }
    }, 300);
  }, [nameSearch, debounce]);

  const availableDivisionOptions = useMemo((): ComboOption[] => {
    if (!districtDivisionEnabled || selectedDistricts.length === 0) return [];
    const selectedCourtIds = new Set(selectedDistricts.map((d) => d.value));
    const divisionCodeSet = new Set<string>();
    trustees.forEach((trustee) => {
      trustee.appointments.forEach((appt) => {
        if (
          selectedCourtIds.has(appt.courtId) &&
          appt.divisionCodes &&
          appt.divisionCodes.length > 0
        ) {
          appt.divisionCodes.forEach((code) => divisionCodeSet.add(code));
        }
      });
    });
    const options: ComboOption[] = [];
    const seen = new Set<string>();
    for (const courtId of selectedCourtIds) {
      const divisions = getDivisionsForDistrict(allCourts, courtId);
      divisions.forEach((div) => {
        if (divisionCodeSet.has(div.courtDivisionCode) && !seen.has(div.courtDivisionCode)) {
          seen.add(div.courtDivisionCode);
          options.push({ value: div.courtDivisionCode, label: div.courtDivisionName });
        }
      });
    }
    return options;
  }, [trustees, selectedDistricts, allCourts, districtDivisionEnabled]);

  const combinedDistrictDivisionOptions = useMemo((): ComboOption[] => {
    if (!districtDivisionEnabled || allCourts.length === 0) return [];
    return getDistrictDivisionComboOptions(allCourts) as ComboOption[];
  }, [allCourts, districtDivisionEnabled]);

  const { filteredTrustees } = useMemo(() => {
    let filtered = filterTrustees(
      trustees,
      selectedDistricts,
      selectedChapters,
      districtDivisionEnabled,
      selectedDivisions,
    );

    if (nameSearch.length >= 2) {
      filtered = filtered.filter((t) => nameSearchIds.has(t.trusteeId));
    }

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
  }, [
    trustees,
    selectedDistricts,
    selectedChapters,
    selectedDivisions,
    nameSearch,
    nameSearchIds,
    sortDirection,
  ]);

  useEffect(() => {
    if (!isDefaultApplied.current) return;
    const defaults = defaultDistrictsRef.current;
    const isDefault =
      selectedDistricts.length === defaults.length &&
      selectedDistricts.every((d) => defaults.some((def) => def.value === d.value));

    const resultCount = filterTrustees(
      trustees,
      selectedDistricts,
      selectedChapters,
      districtDivisionEnabled,
      selectedDivisions,
    ).length;

    getAppInsights().appInsights.trackEvent(
      { name: 'Trustee District Filter Changed' },
      {
        isDefault,
        selectedCount: selectedDistricts.length,
        resultCount,
        chapterCount: selectedChapters.length,
        divisionCount: selectedDivisions.length,
      },
    );
  }, [selectedDistricts, selectedChapters, selectedDivisions, trustees]);

  if (!nameSearchLoading) {
    stableCountRef.current = filteredTrustees.length;
  }

  useEffect(() => {
    if (!isChapterFilterInteracted.current && !isNameFilterInteracted.current) return;
    if (nameSearchLoading) return;
    setLiveAnnouncement(`${filteredTrustees.length} Trustees`);
  }, [filteredTrustees, nameSearchLoading]);

  useEffect(() => {
    if (!isChapterFilterInteracted.current) return;

    const resultCount = filterTrustees(
      trustees,
      selectedDistricts,
      selectedChapters,
      districtDivisionEnabled,
      selectedDivisions,
    ).length;

    getAppInsights().appInsights.trackEvent(
      { name: 'Trustee Chapter Filter Changed' },
      {
        selectedCount: selectedChapters.length,
        resultCount,
        districtCount: selectedDistricts.length,
        selectedChapterValues: selectedChapters.map((c) => c.value).join(','),
      },
    );
  }, [selectedChapters, selectedDistricts, selectedDivisions, trustees]);

  useEffect(() => {
    if (!isNameFilterInteracted.current) return;
    if (nameSearchQueryLengthRef.current < 2) return;

    getAppInsights().appInsights.trackEvent(
      { name: 'Trustee Name Filter Changed' },
      {
        queryLength: nameSearchQueryLengthRef.current,
        resultCount: filteredTrustees.length,
        districtCount: selectedDistricts.length,
        chapterCount: selectedChapters.length,
        searchResponseMs: nameSearchStartRef.current ?? undefined,
        hasDistrictFilter: selectedDistricts.length > 0,
        sessionSearchCount: nameSearchCountRef.current,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameSearchIds]);

  useEffect(() => {
    if (!isNameFilterInteracted.current) return;

    const wasNonEmpty = previousNameSearchRef.current.length > 0;
    const isNowEmpty = nameSearch.length === 0;

    if (wasNonEmpty && isNowEmpty) {
      getAppInsights().appInsights.trackEvent(
        { name: 'Trustee Name Filter Cleared' },
        {
          queryLength: previousNameSearchRef.current.length,
          sessionSearchCount: nameSearchCountRef.current,
        },
      );
    }

    previousNameSearchRef.current = nameSearch;
  }, [nameSearch]);

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
        handleFilterName={handleFilterName}
        handleFilterDivision={handleFilterDivision}
        availableDivisionOptions={availableDivisionOptions}
        combinedDistrictDivisionOptions={combinedDistrictDivisionOptions}
        onCourtsLoaded={setAllCourts}
      />
      <div role="status" aria-live="polite" aria-atomic="true" className="usa-sr-only">
        {liveAnnouncement}
      </div>
      <p className="trustees-list-count">
        {nameSearchLoading
          ? (stableCountRef.current ?? filteredTrustees.length)
          : filteredTrustees.length}{' '}
        Trustee(s)
      </p>
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
          {nameSearchLoading ? (
            <LoadingSpinner caption="Searching trustees..." />
          ) : (
            filteredTrustees.map((trustee) => {
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
                        className="trustees-list-cell col-name"
                        role="cell"
                        {...(idx === 0 ? { 'data-cell': 'Name' } : {})}
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
                        className="trustees-list-cell col-district"
                        role="cell"
                        data-cell="District"
                      >
                        {appt ? formatDistrict(appt) : ''}
                      </div>
                      {districtDivisionEnabled && (
                        <div
                          className="trustees-list-cell col-division"
                          role="cell"
                          data-cell="Division"
                        >
                          {appt ? buildDivisionsDisplay(appt, allCourts) : ''}
                        </div>
                      )}
                      <div
                        className="trustees-list-cell col-chapter"
                        role="cell"
                        data-cell="Chapter"
                      >
                        {appt ? formatChapterType(appt.chapter) : ''}
                      </div>
                      <div className="trustees-list-cell col-type" role="cell" data-cell="Type">
                        {appt ? formatAppointmentType(appt.appointmentType) : ''}
                      </div>
                      <div className="trustees-list-cell col-status" role="cell" data-cell="Status">
                        {appt ? formatAppointmentStatus(appt.status) : ''}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
