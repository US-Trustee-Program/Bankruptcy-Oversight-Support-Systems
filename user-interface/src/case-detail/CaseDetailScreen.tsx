import './CaseDetailScreen.scss';
import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { Route, useParams, useLocation, Outlet, Routes } from 'react-router-dom';
import {
  CaseAssignmentHistoryResponseData,
  CaseDocket,
  CaseDocketEntry,
  Chapter15CaseDetailsResponseData,
  Chapter15CaseDocketResponseData,
  CaseHistory,
  CaseAssociatedCasesResponseData,
} from '@/lib/type-declarations/chapter-15';
import CaseDetailNavigation, { mapNavState, NavState } from './panels/CaseDetailNavigation';
import MultiSelect, { MultiSelectOptionList } from '@/lib/components/MultiSelect';
import { CaseDocketSummaryFacets } from '@/case-detail/panels/CaseDetailCourtDocket';
import Icon from '@/lib/components/uswds/Icon';
import IconInput from '@/lib/components/IconInput';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import DateRangePicker, { DateRange } from '@/lib/components/uswds/DateRangePicker';
import { InputRef } from '@/lib/type-declarations/input-fields';
import CaseDetailAuditHistory from './panels/CaseDetailAuditHistory';
import { CaseDetail } from '@common/cams/cases';
import { useApi } from '@/lib/hooks/UseApi';
import CaseDetailAssociatedCases from './panels/CaseDetailAssociatedCases';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { EventCaseReference } from '@common/cams/events';

const CaseDetailHeader = lazy(() => import('./panels/CaseDetailHeader'));
const CaseDetailBasicInfo = lazy(() => import('./panels/CaseDetailBasicInfo'));
const CaseDetailCourtDocket = lazy(() => import('./panels/CaseDetailCourtDocket'));

type SortDirection = 'Oldest' | 'Newest';

interface DocketLimits {
  dateRange: DateRange;
  documentRange: DocumentRange;
}

interface DocumentRange {
  first: number;
  last: number;
}

interface sortAndFilterOptions {
  searchInDocketText: string;
  selectedFacets: string[];
  sortDirection: SortDirection;
  documentNumber: number | null;
  selectedDateRange: DateRange;
}

export function findDocketLimits(docket: CaseDocket): DocketLimits {
  const dateRange: DateRange = { start: undefined, end: undefined };
  const documentRange: DocumentRange = { first: 0, last: 0 };

  if (!docket.length) return { dateRange, documentRange };

  const firstEntryWithDocument = docket.find((entry) => {
    return !!entry.documentNumber;
  });
  let lastEntryWithDocument = undefined;
  for (let i = docket.length - 1; i >= 0; i--) {
    if (docket[i].documentNumber) {
      lastEntryWithDocument = docket[i];
      break;
    }
  }

  documentRange.first = firstEntryWithDocument?.documentNumber || 0;
  documentRange.last = lastEntryWithDocument?.documentNumber || 0;

  dateRange.start = docket[0].dateFiled;
  dateRange.end = docket[docket.length - 1].dateFiled;

  return { dateRange, documentRange };
}

export function docketSorterClosure(sortDirection: SortDirection) {
  return (left: CaseDocketEntry, right: CaseDocketEntry) => {
    const direction = sortDirection === 'Newest' ? 1 : -1;
    return left.sequenceNumber < right.sequenceNumber ? direction : direction * -1;
  };
}

function dateRangeFilter(docketEntry: CaseDocketEntry, dateRange: DateRange) {
  if (dateRange.start && docketEntry.dateFiled < dateRange.start) return false;
  if (dateRange.end && docketEntry.dateFiled > dateRange.end) return false;
  return true;
}

function docketSearchFilter(docketEntry: CaseDocketEntry, searchString: string) {
  return (
    docketEntry.summaryText.toLowerCase().includes(searchString) ||
    docketEntry.fullText.toLowerCase().includes(searchString)
  );
}

function documentNumberFilter(docketEntry: CaseDocketEntry, documentNumber: number) {
  if (docketEntry.documentNumber === documentNumber) return docketEntry;
}

function facetFilter(docketEntry: CaseDocketEntry, selectedFacets: string[]) {
  if (selectedFacets.length === 0) return docketEntry;
  return selectedFacets.includes(docketEntry.summaryText);
}

export function applySortAndFilters(
  docketEntries: CaseDocketEntry[] | undefined,
  options: sortAndFilterOptions,
) {
  if (docketEntries === undefined) {
    return { filteredDocketEntries: docketEntries, alertOptions: undefined };
  }
  if (options.documentNumber) {
    const filteredDocketEntries = docketEntries.filter((docketEntry) =>
      documentNumberFilter(docketEntry, options.documentNumber!),
    );
    const alertOptions =
      filteredDocketEntries.length === 0
        ? {
            message: 'The document number you entered is not found in the docket.',
            title: 'Document Number Not Found',
            type: UswdsAlertStyle.Warning,
          }
        : undefined;
    return { filteredDocketEntries, alertOptions };
  } else {
    const filteredDocketEntries = docketEntries
      .filter((docketEntry) => dateRangeFilter(docketEntry, options.selectedDateRange))
      .filter((docketEntry) => docketSearchFilter(docketEntry, options.searchInDocketText))
      .filter((docketEntry) => facetFilter(docketEntry, options.selectedFacets))
      .sort(docketSorterClosure(options.sortDirection));
    return { filteredDocketEntries, alertOptions: undefined };
  }
}

function summaryTextFacetReducer(acc: CaseDocketSummaryFacets, de: CaseDocketEntry) {
  if (acc.has(de.summaryText)) {
    const facet = acc.get(de.summaryText)!;
    facet.count = facet.count + 1;
    acc.set(de.summaryText, facet);
  } else {
    acc.set(de.summaryText, { text: de.summaryText, count: 1 });
  }
  return acc;
}

function showReopenDate(reOpenDate: string | undefined, closedDate: string | undefined) {
  if (reOpenDate) {
    if (closedDate && reOpenDate > closedDate) {
      return true;
    }
  }
  return false;
}

export function getSummaryFacetList(facets: CaseDocketSummaryFacets) {
  const facetOptions = [...facets.entries()].map<Record<string, string>>(([key, facet]) => {
    return { value: key, label: `${key} (${facet.count})` };
  });
  return facetOptions.sort((a, b) => {
    if (a.label === b.label) return 0;
    return a.label < b.label ? -1 : 1;
  });
}

interface CaseDetailProps {
  caseDetail?: CaseDetail;
  caseDocketEntries?: CaseDocketEntry[];
  caseHistory?: CaseHistory[];
  associatedCases?: EventCaseReference[];
}

export default function CaseDetailScreen(props: CaseDetailProps) {
  const { caseId } = useParams();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDocketLoading, setIsDocketLoading] = useState<boolean>(false);
  const [isAuditHistoryLoading, setIsAuditHistoryLoading] = useState<boolean>(false);
  const [isAssociatedCasesLoading, setIsAssociatedCasesLoading] = useState<boolean>(false);
  const api = useApi();
  const [caseBasicInfo, setCaseBasicInfo] = useState<CaseDetail>();
  const [caseDocketEntries, setCaseDocketEntries] = useState<CaseDocketEntry[]>();
  const [caseDocketSummaryFacets, setCaseDocketSummaryFacets] = useState<CaseDocketSummaryFacets>(
    new Map(),
  );
  const [caseHistory, setCaseHistory] = useState<CaseHistory[]>([]);
  const [associatedCases, setAssociatedCases] = useState<EventCaseReference[]>([]);
  const [selectedFacets, setSelectedFacets] = useState<string[]>([]);
  const [searchInDocketText, setSearchInDocketText] = useState('');
  const [documentNumber, setDocumentNumber] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('Newest');
  const location = useLocation();
  const [navState, setNavState] = useState<number>(mapNavState(location.pathname));
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>({});
  const [dateRangeBounds, setDateRangeBounds] = useState<DateRange>({});
  const [documentRange, setDocumentRange] = useState<DocumentRange>({ first: 0, last: 0 });
  const findInDocketRef = useRef<InputRef>(null);
  const findByDocketNumberRef = useRef<InputRef>(null);
  const dateRangeRef = useRef<InputRef>(null);
  const facetPickerRef = useRef<InputRef>(null);
  let hasDocketEntries = caseDocketEntries && !!caseDocketEntries.length;

  async function fetchCaseBasicInfo() {
    setIsLoading(true);
    api.get(`/cases/${caseId}`, {}).then((data) => {
      const response = data as Chapter15CaseDetailsResponseData;
      setCaseBasicInfo(response.body?.caseDetails);
      setIsLoading(false);
    });
  }

  async function fetchCaseDocketEntries() {
    setIsDocketLoading(true);
    api
      .get(`/cases/${caseId}/docket`, {})
      .then((data) => {
        const response = data as Chapter15CaseDocketResponseData;
        setCaseDocketEntries(response.body);
        const facets = response.body.reduce<CaseDocketSummaryFacets>(
          summaryTextFacetReducer,
          new Map(),
        );
        const limits = findDocketLimits(response.body);
        setDocumentRange(limits.documentRange);
        setDateRangeBounds(limits.dateRange);
        setCaseDocketSummaryFacets(facets);
        setIsDocketLoading(false);
      })
      .catch(() => {
        setCaseDocketEntries([]);
        setIsDocketLoading(false);
      });
  }

  async function fetchCaseAssignmentHistory() {
    setIsAuditHistoryLoading(true);
    api
      .get(`/cases/${caseId}/history`, {})
      .then((data) => {
        const response = data as CaseAssignmentHistoryResponseData;
        if (response) {
          setCaseHistory(response.body);
          setIsAuditHistoryLoading(false);
        }
      })
      .catch(() => {
        setCaseHistory([]);
        setIsAuditHistoryLoading(false);
      });
  }

  async function fetchAssociatedCases() {
    setIsAssociatedCasesLoading(true);
    api
      .get(`/cases/${caseId}/associated`, {})
      .then((data) => {
        const response = data as CaseAssociatedCasesResponseData;
        if (response) {
          setAssociatedCases(response.body);
          setIsAssociatedCasesLoading(false);
        }
      })
      .catch(() => {
        setAssociatedCases([]);
        setIsAssociatedCasesLoading(false);
      });
  }

  function toggleSort() {
    setSortDirection(sortDirection === 'Newest' ? 'Oldest' : 'Newest');
  }

  function searchDocketText(ev: React.ChangeEvent<HTMLInputElement>) {
    const searchString = ev.target.value.toLowerCase();
    setSearchInDocketText(searchString);
  }

  function searchDocumentNumber(ev: React.ChangeEvent<HTMLInputElement>) {
    const newDocumentNumber = parseInt(ev.target.value.trim());
    if (isNaN(newDocumentNumber)) {
      setDocumentNumber(null);
      return;
    }
    setDocumentNumber(newDocumentNumber);
  }

  function clearFilters() {
    setSearchInDocketText('');
    findInDocketRef.current?.clearValue();
    setDocumentNumber(null);
    findByDocketNumberRef.current?.clearValue();
    setSelectedDateRange({ ...selectedDateRange, start: undefined, end: undefined });
    dateRangeRef.current?.clearValue();
    setSelectedFacets([]);
    facetPickerRef.current?.clearValue();
    return;
  }

  function handleSelectedFacet(newValue: MultiSelectOptionList<Record<string, string>>) {
    const selected = newValue.map((value: Record<string, string>) => {
      const { value: selection } = value;
      return selection;
    });
    setSelectedFacets(selected);
  }

  function handleStartDateChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setSelectedDateRange({ ...selectedDateRange, start: ev.target.value });
  }

  function handleEndDateChange(ev: React.ChangeEvent<HTMLInputElement>) {
    setSelectedDateRange({ ...selectedDateRange, end: ev.target.value });
  }

  useEffect(() => {
    if (props.caseDetail) {
      setCaseBasicInfo(props.caseDetail);
      setIsLoading(false);
    } else if (!isLoading) {
      fetchCaseBasicInfo();
    }
  }, []);

  useEffect(() => {
    if (props.caseDocketEntries) {
      setCaseDocketEntries(props.caseDocketEntries);
      hasDocketEntries = !!props.caseDocketEntries.length;
      const facets = props.caseDocketEntries.reduce(summaryTextFacetReducer, new Map());
      setCaseDocketSummaryFacets(facets);
    } else {
      fetchCaseDocketEntries();
    }
  }, []);

  useEffect(() => {
    if (props.associatedCases) {
      setAssociatedCases(props.associatedCases);
    } else {
      fetchAssociatedCases();
    }
  }, []);

  useEffect(() => {
    if (props.caseHistory) {
      setCaseHistory(props.caseHistory);
    } else {
      fetchCaseAssignmentHistory();
    }
  }, []);

  useEffect(() => {
    setNavState(mapNavState(location.pathname));
    if (navState !== NavState.COURT_DOCKET) {
      setSelectedFacets([]);
    }
  }, [location]);

  const { filteredDocketEntries, alertOptions } = applySortAndFilters(caseDocketEntries, {
    searchInDocketText,
    selectedFacets,
    sortDirection,
    documentNumber,
    selectedDateRange,
  });

  return (
    <>
      <div className="case-detail" data-testid="case-detail">
        {isLoading && (
          <>
            <CaseDetailHeader isLoading={isLoading} caseId={caseId} />
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-2">
                <CaseDetailNavigation
                  caseId={caseId}
                  initiallySelectedNavLink={navState}
                  showAssociatedCasesList={false}
                />
              </div>
              <div className="grid-col-8">
                <LoadingSpinner caption="Loading case details..." />
              </div>
              <div className="grid-col-1"></div>
            </div>
          </>
        )}
        {!isLoading && caseBasicInfo && (
          <>
            <CaseDetailHeader
              isLoading={false}
              caseId={caseBasicInfo.caseId}
              caseDetail={caseBasicInfo}
            />
            <div className="grid-row grid-gap-lg">
              <div id="left-gutter" className="grid-col-1"></div>
              <div className="grid-col-2">
                <div className={'left-navigation-pane-container'}>
                  <CaseDetailNavigation
                    caseId={caseId}
                    initiallySelectedNavLink={navState}
                    showAssociatedCasesList={
                      caseBasicInfo.consolidation != undefined &&
                      caseBasicInfo.consolidation?.length > 0
                    }
                  />
                  {hasDocketEntries && navState === NavState.COURT_DOCKET && (
                    <div
                      className={`filter-and-search padding-y-4`}
                      data-testid="filter-and-search-panel"
                    >
                      <div className="sort form-field">
                        <div className="usa-sort usa-sort--small">
                          <button
                            className="usa-button usa-button--outline sort-button"
                            id="basic-sort-button"
                            name="basic-sort"
                            onClick={toggleSort}
                            data-testid="docket-entry-sort"
                            aria-label={'Sort ' + sortDirection + ' First'}
                          >
                            <div aria-hidden="true">
                              <span aria-hidden="true">Sort ({sortDirection})</span>
                              <Icon
                                className="sort-button-icon"
                                name={
                                  sortDirection === 'Newest' ? 'arrow_upward' : 'arrow_downward'
                                }
                              />
                            </div>
                          </button>
                        </div>
                      </div>
                      <div
                        className="in-docket-search form-field"
                        data-testid="docket-entry-search"
                      >
                        <div className="usa-search usa-search--small">
                          <label htmlFor="basic-search-field">Find in Docket</label>
                          <IconInput
                            className="search-icon"
                            id="basic-search-field"
                            name="basic-search"
                            icon="search"
                            autocomplete="off"
                            onChange={searchDocketText}
                            ref={findInDocketRef}
                          />
                        </div>
                      </div>
                      <div
                        className="docket-summary-facets form-field"
                        data-testid="facet-multi-select-container-test-id"
                      >
                        <label>Filter by Summary</label>
                        <MultiSelect
                          id="facet-multi-select"
                          options={getSummaryFacetList(caseDocketSummaryFacets)}
                          closeMenuOnSelect={false}
                          onChange={handleSelectedFacet}
                          label="Filter by Summary"
                          ref={facetPickerRef}
                        ></MultiSelect>
                      </div>
                      <div className="in-docket-search form-field" data-testid="docket-date-range">
                        <DateRangePicker
                          id="docket-date-range"
                          startDateLabel="Docket Entries from"
                          endDateLabel="To"
                          onStartDateChange={handleStartDateChange}
                          onEndDateChange={handleEndDateChange}
                          minDate={dateRangeBounds.start}
                          maxDate={dateRangeBounds.end}
                          ref={dateRangeRef}
                        ></DateRangePicker>
                      </div>
                      <div
                        className="in-docket-search form-field"
                        data-testid="docket-number-search"
                      >
                        <div className="usa-search usa-search--small">
                          <label htmlFor="document-number-search-field">
                            Go to Document Number
                          </label>
                          <IconInput
                            pattern="^[0-9]*$"
                            inputmode="numeric"
                            title="Enter numbers only"
                            className="search-icon"
                            id="document-number-search-field"
                            type="number"
                            name="search-by-document-number"
                            icon="search"
                            autocomplete="off"
                            onChange={searchDocumentNumber}
                            min={documentRange.first}
                            max={documentRange.last}
                            ref={findByDocketNumberRef}
                          />
                        </div>
                      </div>
                      <div className="form-field">
                        <button
                          className="usa-button usa-button--outline clear-filters-button"
                          id="clear-filters-button"
                          name="clear-filters"
                          onClick={clearFilters}
                          data-testid="clear-filters"
                          aria-label="Clear All Filters"
                        >
                          <span aria-hidden="true">Clear All Filters</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid-col-6">
                <Suspense fallback={<LoadingSpinner />}>
                  <Routes>
                    <Route
                      index
                      element={
                        <CaseDetailBasicInfo
                          caseDetail={caseBasicInfo}
                          showReopenDate={showReopenDate(
                            caseBasicInfo?.reopenedDate,
                            caseBasicInfo?.closedDate,
                          )}
                        />
                      }
                    />
                    <Route
                      path="court-docket"
                      element={
                        <CaseDetailCourtDocket
                          caseId={caseBasicInfo.caseId}
                          docketEntries={filteredDocketEntries}
                          alertOptions={alertOptions}
                          searchString={searchInDocketText}
                          hasDocketEntries={!!caseDocketEntries && caseDocketEntries?.length > 1}
                          isDocketLoading={isDocketLoading}
                        />
                      }
                    />
                    <Route
                      path="audit-history"
                      element={
                        <CaseDetailAuditHistory
                          caseHistory={caseHistory}
                          isAuditHistoryLoading={isAuditHistoryLoading}
                        />
                      }
                    />
                    <Route
                      path="associated-cases"
                      element={
                        <CaseDetailAssociatedCases
                          associatedCases={associatedCases}
                          isAssociatedCasesLoading={isAssociatedCasesLoading}
                        />
                      }
                    />
                  </Routes>
                </Suspense>
                <Outlet />
              </div>
              <div className="grid-col-2"></div>
              <div id="right-gutter" className="grid-col-1"></div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
