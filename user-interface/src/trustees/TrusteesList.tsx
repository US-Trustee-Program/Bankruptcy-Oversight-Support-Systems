import './TrusteesList.scss';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TrusteeName } from '@/case-detail/panels/TrusteeName';
import { AppointmentStatus, TrusteeListItem } from '@common/cams/trustees';
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
import { StatusFilterValue, TrusteeDistrictFilterRef } from './filters/trusteeDistrictFilter.types';
import Icon from '@/lib/components/uswds/Icon';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';
import {
  sortTrusteeAppointments,
  buildDivisionsDisplay,
  getDistrictDivisionComboOptions,
} from '@/lib/utils/court-utils';
import useFeatureFlags, { TRUSTEE_DISTRICT_DIVISION } from '@/lib/hooks/UseFeatureFlags';
import { CourtDivisionDetails } from '@common/cams/courts';
import { Pagination } from '@/lib/components/uswds/Pagination';
import { Pagination as PaginationModel } from '@common/api/pagination';
import { DEFAULT_SEARCH_LIMIT, DEFAULT_SEARCH_OFFSET } from '@common/api/search';

export const getTrusteeListLinkTestId = (trusteeId: string) => `trustee-link-${trusteeId}`;

const BASE_COLUMN_HEADERS = ['Name', 'District', 'Chapter', 'Type', 'Status'];
const DIVISION_COLUMN_HEADERS = ['Name', 'District', 'Division', 'Chapter', 'Type', 'Status'];

function formatListAppointmentStatus(status: AppointmentStatus): string {
  if (status === 'active') return 'Active';
  if (status === 'inactive') return 'Inactive';
  return `Inactive (${formatAppointmentStatus(status)})`;
}

type DivisionFilterMap = Map<string, Set<string>>;

function buildDivisionFilterMap(selectedDivisions: ComboOption[]): DivisionFilterMap {
  const courtFilter = new Map<string, Set<string>>();
  for (const opt of selectedDivisions) {
    const [courtId, code] = opt.value.split('|');
    if (!courtFilter.has(courtId)) courtFilter.set(courtId, new Set());
    courtFilter.get(courtId)!.add(code);
  }
  return courtFilter;
}

function isUserInSelectedDivision(trustee: TrusteeListItem, divisionFilter: DivisionFilterMap) {
  if (divisionFilter.size === 0) return true;

  return trustee.appointments.some((appt) => {
    const allowed = divisionFilter.get(appt.courtId);
    if (!allowed) return false;
    if (allowed.has('ALL')) return true;
    if (!appt.divisionCodes || appt.divisionCodes.length === 0) return true;
    return appt.divisionCodes.some((code) => allowed.has(code));
  });
}

function filterTrustees(
  trustees: TrusteeListItem[],
  selectedDistricts: ComboOption[],
  selectedChapters: ComboOption[],
  districtDivisionEnabled: boolean = false,
  divisionFilterMap: DivisionFilterMap = new Map(),
): TrusteeListItem[] {
  if (
    selectedChapters.length === 0 &&
    selectedDistricts.length === 0 &&
    divisionFilterMap.size === 0
  ) {
    return trustees;
  }

  const selectedChapterValues = new Set(selectedChapters.map((c) => c.value));
  return trustees.filter((trustee) => {
    const trusteeMatchesChapter =
      selectedChapters.length === 0 ||
      trustee.appointments.some((appt) => selectedChapterValues.has(appt.chapter));
    if (!trusteeMatchesChapter) return false;

    if (!districtDivisionEnabled) {
      if (selectedDistricts.length === 0) return true;
      const selectedDivisionCodes = new Set(selectedDistricts.flatMap((d) => d.value.split(',')));
      return trustee.appointments.some(
        (appt) => appt.divisionCode && selectedDivisionCodes.has(appt.divisionCode),
      );
    }

    return isUserInSelectedDivision(trustee, divisionFilterMap);
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
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('active');
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>('');
  const [nameSearch, setNameSearch] = useState('');
  const [nameSearchIds, setNameSearchIds] = useState<Set<string>>(new Set());
  const [nameSearchLoading, setNameSearchLoading] = useState(false);
  const [nameSearchError, setNameSearchError] = useState(false);
  const [allCourts, setAllCourts] = useState<CourtDivisionDetails[]>([]);
  const [offset, setOffset] = useState(DEFAULT_SEARCH_OFFSET);
  const [limit, setLimit] = useState(DEFAULT_SEARCH_LIMIT);
  const flags = useFeatureFlags();
  const districtDivisionEnabled = !!flags[TRUSTEE_DISTRICT_DIVISION];
  const COLUMN_HEADERS = districtDivisionEnabled ? DIVISION_COLUMN_HEADERS : BASE_COLUMN_HEADERS;
  const stableCountRef = useRef<number | null>(null);
  const filterRef = useRef<TrusteeDistrictFilterRef>(null);
  const pageLoadStart = useRef(performance.now());
  const hasExpandedOnceRef = useRef(false);
  const isNameFilterInteracted = useRef(false);
  const previousNameSearchRef = useRef('');
  const nameSearchCountRef = useRef(0);
  const nameSearchStartRef = useRef<number | null>(null);
  const nameSearchQueryLengthRef = useRef(0);
  const nameSearchRef = useRef('');
  const debounce = useDebounce();

  useEffect(() => {
    const fetchTrustees = () => {
      setLoading(true);
      Api2.getTrustees(statusFilter)
        .then((trusteesResponse) => {
          const data = trusteesResponse.data ?? [];
          setTrustees(data);
          setError(null);
          getAppInsights().appInsights.trackEvent(
            { name: 'Trustee List Loaded' },
            {
              trusteeCount: data.length,
              loadMs: performance.now() - pageLoadStart.current,
              statusFilter,
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
  }, [statusFilter]);

  const defaultDistrictsRef = useRef<ComboOption[]>([]);
  const isDefaultApplied = useRef(false);
  const isChapterFilterInteracted = useRef(false);
  const isDistrictFilterInteracted = useRef(false);
  const lastFilterChanged = useRef<'district' | 'chapter' | 'name' | null>(null);

  const handleFilterDistrict = (districts: ComboOption[]) => {
    if (!isDefaultApplied.current) {
      defaultDistrictsRef.current = districts;
      isDefaultApplied.current = true;
    } else {
      isDistrictFilterInteracted.current = true;
      lastFilterChanged.current = 'district';
    }
    setSelectedDivisions([]);
    setSelectedDistricts(districts);
    setLiveAnnouncement('');
  };

  const handleFilterDivision = (divisions: ComboOption[]) => {
    isDistrictFilterInteracted.current = true;
    lastFilterChanged.current = 'district';
    setLiveAnnouncement('');
    setSelectedDivisions(divisions);
  };

  const handleFilterChapter = (chapters: ComboOption[]) => {
    isChapterFilterInteracted.current = true;
    lastFilterChanged.current = 'chapter';
    setLiveAnnouncement('');
    setSelectedChapters(chapters);
  };

  const handleFilterStatus = (status: StatusFilterValue) => {
    setLiveAnnouncement('');
    setStatusFilter(status);
  };

  const handleFilterName = (name: string) => {
    isNameFilterInteracted.current = true;
    lastFilterChanged.current = 'name';
    if (name.length >= 2) setNameSearchLoading(true);
    setNameSearchError(false);
    nameSearchRef.current = name;
    setNameSearch(name);
  };

  const handlePaginationChange = ({ limit, offset }: { limit: number; offset: number }) => {
    setOffset(offset);
    setLimit(limit);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const combinedDistrictDivisionOptions = useMemo((): ComboOption[] => {
    if (!districtDivisionEnabled || allCourts.length === 0) return [];
    return getDistrictDivisionComboOptions(allCourts) as ComboOption[];
  }, [allCourts, districtDivisionEnabled]);

  const divisionFilterMap = useMemo(
    () => buildDivisionFilterMap(selectedDivisions),
    [selectedDivisions],
  );

  const baseFilteredTrustees = useMemo(
    () =>
      filterTrustees(
        trustees,
        selectedDistricts,
        selectedChapters,
        districtDivisionEnabled,
        divisionFilterMap,
      ),
    [trustees, selectedDistricts, selectedChapters, districtDivisionEnabled, divisionFilterMap],
  );

  useEffect(() => {
    let announcementTimeoutId: NodeJS.Timeout | null = null;

    if (nameSearch.length < 2) {
      nameSearchQueryLengthRef.current = 0;
      setNameSearchIds(new Set());
      setNameSearchLoading(false);

      // Announce when clearing name filter (only if user explicitly cleared it)
      if (isNameFilterInteracted.current && hasExpandedOnceRef.current && nameSearch.length === 0) {
        const announcement =
          baseFilteredTrustees.length + ' Trustee' + (baseFilteredTrustees.length === 1 ? '' : 's');
        setLiveAnnouncement(announcement);
      }
      return;
    }
    nameSearchQueryLengthRef.current = nameSearch.length;
    setNameSearchLoading(true);
    debounce(async () => {
      const searchStart = performance.now();
      const searchTerm = nameSearch;
      setLiveAnnouncement('');
      try {
        const response = await Api2.searchTrustees(nameSearch);
        nameSearchCountRef.current += 1;
        const ids = new Set(response.data.map((r) => r.trusteeId));
        nameSearchStartRef.current = performance.now() - searchStart;
        if (searchTerm === nameSearchRef.current) {
          setNameSearchIds(ids);
          setNameSearchError(false);
        }

        announcementTimeoutId = setTimeout(() => {
          if (searchTerm !== nameSearch || nameSearch.length < 2) return;
          if (!hasExpandedOnceRef.current) return;

          const filtered = baseFilteredTrustees.filter((t) => ids.has(t.trusteeId));
          const announcement = filtered.length + ' Trustee' + (filtered.length === 1 ? '' : 's');
          setLiveAnnouncement(announcement);
        }, 500);
      } catch {
        nameSearchStartRef.current = null;
        setNameSearchIds(new Set());
        setNameSearchError(true);
      } finally {
        setNameSearchLoading(false);
      }
    }, 300);

    return () => {
      if (announcementTimeoutId) {
        clearTimeout(announcementTimeoutId);
      }
    };
  }, [nameSearch, debounce, baseFilteredTrustees]);

  const handleFilterExpanded = (isExpanded: boolean) => {
    if (isExpanded && !hasExpandedOnceRef.current) {
      hasExpandedOnceRef.current = true;
      const resultCount = filteredTrustees.length;
      const districtCount = selectedDistricts.length;
      const divisionCount = selectedDivisions.length;
      const chapterCount = selectedChapters.length;
      const hasNameFilter = nameSearch.length >= 2;

      let announcement = resultCount + ' Trustee' + (resultCount === 1 ? '' : 's');

      const filters = [];
      if (hasNameFilter) filters.push('name');
      if (districtDivisionEnabled && divisionCount > 0) {
        filters.push('district (division)');
      } else if (!districtDivisionEnabled && districtCount > 0) {
        filters.push('district');
      }
      if (chapterCount > 0) filters.push('chapter');

      if (filters.length > 0) {
        announcement += ' filtered by ' + filters.join(' and ');
      }

      setLiveAnnouncement(announcement);
    } else if (!isExpanded) {
      // Reset when closing
      hasExpandedOnceRef.current = false;
      setLiveAnnouncement('');
    }
  };

  // Announce on district/chapter/division filter changes after first expand
  useEffect(() => {
    if (!hasExpandedOnceRef.current) return;
    if (!isDistrictFilterInteracted.current && !isChapterFilterInteracted.current) return;
    if (lastFilterChanged.current === 'name') return;

    let filtered = baseFilteredTrustees;
    if (!nameSearchError && nameSearch.length >= 2) {
      filtered = filtered.filter((t) => nameSearchIds.has(t.trusteeId));
    }

    const announcement = filtered.length + ' Trustee' + (filtered.length === 1 ? '' : 's');
    setLiveAnnouncement(announcement);
  }, [baseFilteredTrustees, nameSearch, nameSearchIds, nameSearchError]);

  const { filteredTrustees } = useMemo(() => {
    let filtered = baseFilteredTrustees;

    if (!nameSearchError && nameSearch.length >= 2) {
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

    const sortedWithAppointments = sorted.map((trustee) => ({
      ...trustee,
      appointments: sortTrusteeAppointments(trustee.appointments),
    }));

    return {
      filteredTrustees: sortedWithAppointments,
    };
  }, [baseFilteredTrustees, nameSearch, nameSearchIds, sortDirection]);

  useEffect(() => {
    setOffset(DEFAULT_SEARCH_OFFSET);
  }, [
    statusFilter,
    selectedDistricts,
    selectedDivisions,
    selectedChapters,
    nameSearch,
    sortDirection,
  ]);

  const pagedTrustees = useMemo(
    () => filteredTrustees.slice(offset, offset + limit),
    [filteredTrustees, offset, limit],
  );

  const paginationValues = useMemo((): PaginationModel => {
    return {
      count: pagedTrustees.length,
      limit,
      currentPage: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(filteredTrustees.length / limit),
      totalCount: filteredTrustees.length,
    };
  }, [pagedTrustees, filteredTrustees, offset, limit]);

  const hasMultiplePages = (paginationValues.totalPages ?? 0) > 1;

  useEffect(() => {
    if (!isDefaultApplied.current) return;
    const defaults = defaultDistrictsRef.current;
    const isDefault =
      selectedDistricts.length === defaults.length &&
      selectedDistricts.every((d) => defaults.some((def) => def.value === d.value));

    getAppInsights().appInsights.trackEvent(
      { name: 'Trustee District Filter Changed' },
      {
        isDefault,
        selectedCount: selectedDistricts.length,
        resultCount: baseFilteredTrustees.length,
        chapterCount: selectedChapters.length,
        divisionCount: selectedDivisions.length,
      },
    );
  }, [selectedDistricts, selectedChapters, selectedDivisions, baseFilteredTrustees]);

  if (!nameSearchLoading) {
    stableCountRef.current = filteredTrustees.length;
  }

  useEffect(() => {
    if (!isChapterFilterInteracted.current) return;

    getAppInsights().appInsights.trackEvent(
      { name: 'Trustee Chapter Filter Changed' },
      {
        selectedCount: selectedChapters.length,
        resultCount: baseFilteredTrustees.length,
        districtCount: selectedDistricts.length,
        selectedChapterValues: selectedChapters.map((c) => c.value).join(','),
      },
    );
  }, [selectedChapters, selectedDistricts, selectedDivisions, baseFilteredTrustees]);

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

  let displayCount = filteredTrustees.length;
  if (nameSearchLoading && stableCountRef.current !== null) {
    displayCount = stableCountRef.current;
  }

  const renderPageStatus = () => {
    if (loading) return <LoadingSpinner caption="Loading trustees..." />;
    if (error) {
      return (
        <Alert
          type={UswdsAlertStyle.Error}
          title="Error loading trustees"
          message={error}
          show={true}
          inline={true}
        />
      );
    }
    return null;
  };

  const pageStatus = renderPageStatus();

  return (
    <div className="trustees-list">
      <TrusteeDistrictFilter
        ref={filterRef}
        handleFilterDistrict={handleFilterDistrict}
        handleFilterChapter={handleFilterChapter}
        handleFilterName={handleFilterName}
        handleFilterDivision={handleFilterDivision}
        handleFilterStatus={handleFilterStatus}
        statusFilter={statusFilter}
        combinedDistrictDivisionOptions={combinedDistrictDivisionOptions}
        onExpandedChange={handleFilterExpanded}
        onCourtsLoaded={setAllCourts}
      />
      <div role="status" aria-live="polite" aria-atomic="true" className="usa-sr-only">
        {liveAnnouncement}
      </div>
      {pageStatus ?? (
        <>
          {nameSearchError && (
            <Alert
              type={UswdsAlertStyle.Error}
              title="Trustee name search results not available"
              message="We are unable to retrieve trustee name search results at this time. Please try again later. If the problem persists, please submit a feedback request describing the issue."
              show={true}
              inline={true}
              className="trustees-list-name-search-error"
            />
          )}
          {filteredTrustees.length === 0 && !nameSearchLoading ? (
            <Alert
              type={UswdsAlertStyle.Info}
              title="No trustees found"
              message="Consider adjusting your filters."
              show={true}
              inline={true}
              role="status"
            />
          ) : (
            <p className="trustees-list-count" aria-live="off" aria-atomic="false">
              {displayCount} {displayCount === 1 ? 'Trustee' : 'Trustees'}
            </p>
          )}
          {(filteredTrustees.length > 0 || nameSearchLoading) && (
            <div
              className="trustees-list-grid"
              role="table"
              aria-label="Trustees"
              aria-live="off"
              aria-atomic="false"
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
                          isNameCol
                            ? sortDirection === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : undefined
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
                          <Icon
                            name={sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                          />
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
                  pagedTrustees.map((trustee) => {
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
                                <TrusteeName
                                  trusteeName={formatTrusteeListName(
                                    trustee.firstName,
                                    trustee.middleName,
                                    trustee.lastName,
                                    trustee.name,
                                  )}
                                  trusteeId={trustee.trusteeId}
                                  dataTestId={getTrusteeListLinkTestId(trustee.trusteeId)}
                                  source="trustee-list"
                                />
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
                            <div
                              className="trustees-list-cell col-type"
                              role="cell"
                              data-cell="Type"
                            >
                              {appt ? formatAppointmentType(appt.appointmentType) : ''}
                            </div>
                            <div
                              className="trustees-list-cell col-status"
                              role="cell"
                              data-cell="Status"
                            >
                              {appt ? formatListAppointmentStatus(appt.status) : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
          {hasMultiplePages && (
            <div aria-live="off" aria-atomic="false">
              <Pagination<{ limit: number; offset: number }>
                paginationValues={paginationValues}
                searchPredicate={{ limit, offset }}
                retrievePage={handlePaginationChange}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
