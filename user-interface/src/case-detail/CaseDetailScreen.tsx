import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { Route, useParams, useLocation, Outlet, Routes, Link, Navigate } from 'react-router-dom';
import CaseDetailNavigation, { mapNavState, CaseNavState } from './panels/CaseDetailNavigation';
import { CaseDocketSummaryFacets } from '@/case-detail/panels/CaseDetailCourtDocket';
import Icon from '@/lib/components/uswds/Icon';
import Input from '@/lib/components/uswds/Input';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import DateRangePicker from '@/lib/components/uswds/DateRangePicker';
import {
  ComboBoxRef,
  DateRange,
  DateRangePickerRef,
  InputRef,
} from '@/lib/type-declarations/input-fields';
import CaseDetailAuditHistory from './panels/CaseDetailAuditHistory';
import { CaseDetail, CaseDocket, CaseDocketEntry } from '@common/cams/cases';
import CaseDetailAssociatedCases from './panels/CaseDetailAssociatedCases';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { EventCaseReference } from '@common/cams/events';
import { DEFAULT_MIN_DATE } from '@common/date-helper';
import './CaseDetailScreen.scss';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import { AssignAttorneyModalCallbackProps } from '@/staff-assignment/modal/assignAttorneyModal.types';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import Api2 from '@/lib/models/api2';
import { CaseAssignment } from '@common/cams/assignments';
import { CamsRole } from '@common/cams/roles';
import CaseNotes from './panels/case-notes/CaseNotes';
import CaseDetailTrusteeAndAssignedStaff from './panels/CaseDetailTrusteeAndAssignedStaff';
import CaseDetailTrusteePanel from './panels/CaseDetailTrusteePanel';
import useFeatureFlags, { VIEW_TRUSTEE_ON_CASE } from '@/lib/hooks/UseFeatureFlags';

const CaseDetailHeader = lazy(() => import('./panels/CaseDetailHeader'));
const CaseDetailOverview = lazy(() => import('./panels/CaseDetailOverview'));
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

interface DocketSortAndFilterOptions {
  searchInDocketText: string;
  selectedFacets: string[];
  sortDirection: SortDirection;
  documentNumber: number | null;
  selectedDateRange: DateRange;
}

export function findDocketLimits(docket: CaseDocket): DocketLimits {
  const dateRange: DateRange = { start: undefined, end: undefined };
  const documentRange: DocumentRange = { first: 0, last: 0 };

  if (!docket.length) {
    return { dateRange, documentRange };
  }

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

function docketSorterClosure(sortDirection: SortDirection) {
  return (left: CaseDocketEntry, right: CaseDocketEntry) => {
    const direction = sortDirection === 'Newest' ? 1 : -1;
    return left.sequenceNumber < right.sequenceNumber ? direction : direction * -1;
  };
}

function dateRangeFilter(docketEntry: CaseDocketEntry, dateRange: DateRange) {
  if (dateRange.start && docketEntry.dateFiled < dateRange.start) {
    return false;
  }
  return !(dateRange.end && docketEntry.dateFiled > dateRange.end);
}

function docketSearchFilter(docketEntry: CaseDocketEntry, searchString: string) {
  return (
    docketEntry.summaryText.toLowerCase().includes(searchString) ||
    docketEntry.fullText.toLowerCase().includes(searchString)
  );
}

function documentNumberFilter(docketEntry: CaseDocketEntry, documentNumber: number) {
  if (docketEntry.documentNumber === documentNumber) {
    return docketEntry;
  }
}

function facetFilter(docketEntry: CaseDocketEntry, selectedFacets: string[]) {
  if (selectedFacets.length === 0) {
    return docketEntry;
  }
  return selectedFacets.includes(docketEntry.summaryText);
}

export function applyDocketEntrySortAndFilters(
  docketEntries: CaseDocketEntry[] | undefined,
  options: DocketSortAndFilterOptions,
) {
  if (docketEntries === undefined) {
    return { filteredDocketEntries: docketEntries, alertOptions: undefined };
  }
  if (options.documentNumber) {
    const filteredDocketEntries = docketEntries.filter((docketEntry) =>
      documentNumberFilter(docketEntry, options.documentNumber!),
    );
    const docketAlertOptions =
      filteredDocketEntries.length === 0
        ? {
            message: 'The document number you entered is not found in the docket.',
            title: 'Document Number Not Found',
            type: UswdsAlertStyle.Warning,
          }
        : undefined;
    return { filteredDocketEntries, docketAlertOptions };
  } else {
    let dateFilteredDocketEntries = [...docketEntries];
    if (options.selectedDateRange) {
      dateFilteredDocketEntries = docketEntries.filter((docketEntry) =>
        dateRangeFilter(docketEntry, options.selectedDateRange),
      );
      if (dateFilteredDocketEntries.length === 0) {
        const docketAlertOptions = {
          message:
            'The date filter selected is out of range. No dockets found during the given period.',
          title: 'No Document Found in Specified Date Range',
          type: UswdsAlertStyle.Warning,
        };
        return { dateFilteredDocketEntries, docketAlertOptions };
      }
    }
    const filteredDocketEntries = dateFilteredDocketEntries
      .filter((docketEntry) => docketSearchFilter(docketEntry, options.searchInDocketText))
      .filter((docketEntry) => facetFilter(docketEntry, options.selectedFacets))
      .sort(docketSorterClosure(options.sortDirection));
    return { filteredDocketEntries, docketAlertOptions: undefined };
  }
}

function summaryTextFacetReducer(acc: CaseDocketSummaryFacets, de: CaseDocketEntry) {
  if (acc.has(de.summaryText)) {
    const facet = acc.get(de.summaryText)!;
    facet.count += 1;
    acc.set(de.summaryText, facet);
  } else {
    acc.set(de.summaryText, { text: de.summaryText, count: 1 });
  }
  return acc;
}

function showReopenDate(reOpenDate: string | undefined, closedDate: string | undefined) {
  if (reOpenDate && closedDate) {
    const parsedReOpenDate = Date.parse(reOpenDate);
    const parsedClosedDate = Date.parse(closedDate);
    if (parsedReOpenDate > parsedClosedDate) {
      return true;
    }
  }
  return false;
}

export function getSummaryFacetList(facets: CaseDocketSummaryFacets) {
  const facetOptions = [...facets.entries()].map<ComboOption>(([key, facet]) => {
    return { value: key, label: `${key} (${facet.count})` };
  });
  return facetOptions.sort((a, b) => {
    if (a.label === b.label) {
      return 0;
    }
    return a.label < b.label ? -1 : 1;
  });
}

interface CaseDetailProps {
  caseDetail?: CaseDetail;
  caseDocketEntries?: CaseDocketEntry[];
  associatedCases?: EventCaseReference[];
}

export default function CaseDetailScreen(props: Readonly<CaseDetailProps>) {
  const { caseId } = useParams();

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDocketLoading, setIsDocketLoading] = useState<boolean>(false);
  const [isAssociatedCasesLoading, setIsAssociatedCasesLoading] = useState<boolean>(false);
  const [caseBasicInfo, setCaseBasicInfo] = useState<CaseDetail>();
  const [caseDocketEntries, setCaseDocketEntries] = useState<CaseDocketEntry[]>();
  const [caseDocketSummaryFacets, setCaseDocketSummaryFacets] = useState<CaseDocketSummaryFacets>(
    new Map(),
  );
  const [associatedCases, setAssociatedCases] = useState<EventCaseReference[]>([]);
  const [selectedFacets, setSelectedFacets] = useState<string[]>([]);
  const [searchInDocketText, setSearchInDocketText] = useState('');
  const [documentNumber, setDocumentNumber] = useState<number | null>(null);
  const [docketSortDirection, setDocketSortDirection] = useState<SortDirection>('Newest');
  const location = useLocation();
  const [navState, setNavState] = useState<number>(mapNavState(location.pathname));
  const flags = useFeatureFlags();
  const showTrusteeTab = !!flags[VIEW_TRUSTEE_ON_CASE];
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>({});
  const [documentRange, setDocumentRange] = useState<DocumentRange>({ first: 0, last: 0 });
  const [documentNumberError, setDocumentNumberError] = useState<boolean>(false);

  const findInDocketRef = useRef<InputRef>(null);
  const findByDocketNumberRef = useRef<InputRef>(null);
  const dateRangeRef = useRef<DateRangePickerRef>(null);
  const facetPickerRef = useRef<ComboBoxRef>(null);

  let hasDocketEntries = caseDocketEntries && !!caseDocketEntries.length;

  const globalAlert = useGlobalAlert();

  async function fetchCaseBasicInfo() {
    setIsLoading(true);
    Api2.getCaseDetail(caseId!)
      .then((response) => {
        setCaseBasicInfo(response.data);
      })
      .catch((_error) => {
        globalAlert?.error('Could not get case information.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  async function fetchCaseDocketEntries() {
    setIsDocketLoading(true);
    Api2.getCaseDocket(caseId!)
      .then((response) => {
        setCaseDocketEntries(response.data);
        const facets = response.data.reduce<CaseDocketSummaryFacets>(
          summaryTextFacetReducer,
          new Map(),
        );
        const limits = findDocketLimits(response.data);
        setDocumentRange(limits.documentRange);
        setCaseDocketSummaryFacets(facets);
      })
      .catch(() => {
        setCaseDocketEntries([]);
      })
      .finally(() => setIsDocketLoading(false));
  }

  async function fetchAssociatedCases() {
    setIsAssociatedCasesLoading(true);
    Api2.getCaseAssociations(caseId!)
      .then((response) => {
        if (response) {
          setAssociatedCases(response.data);
        }
      })
      .catch(() => {
        setAssociatedCases([]);
      })
      .finally(() => setIsAssociatedCasesLoading(false));
  }

  function toggleDocketSort() {
    setDocketSortDirection(docketSortDirection === 'Newest' ? 'Oldest' : 'Newest');
  }

  function searchDocketText(ev: React.ChangeEvent<HTMLInputElement>) {
    const searchString = ev.target.value.toLowerCase();
    setSearchInDocketText(searchString);
  }

  function searchDocumentNumber(ev: React.ChangeEvent<HTMLInputElement>) {
    const newDocumentNumber = Number.parseInt(ev.target.value.trim());
    if (Number.isNaN(newDocumentNumber)) {
      setDocumentNumber(null);
      setDocumentNumberError(ev.target.value.trim().length !== 0);
      return;
    }
    setDocumentNumberError(false);
    setDocumentNumber(newDocumentNumber);
  }

  function clearDocketFilters() {
    setSearchInDocketText('');
    findInDocketRef.current?.clearValue();
    setDocumentNumber(null);
    findByDocketNumberRef.current?.clearValue();
    setSelectedDateRange({ ...selectedDateRange, start: undefined, end: undefined });
    dateRangeRef.current?.clearValue();
    setSelectedFacets([]);
    facetPickerRef.current?.clearSelections();
  }

  function handleFacetClear(values: ComboOption[]) {
    if (values.length === 0) {
      setSelectedFacets([]);
    }
  }

  function handleSelectedFacet(newValue: ComboOption[]) {
    const selected = newValue.map((value: ComboOption) => {
      const { value: selection } = value;
      return selection;
    });
    setSelectedFacets(selected);
  }

  function handleStartDateChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const start = ev.target.dataset.start || ev.target.value;
    const end = ev.target.dataset.end;
    setSelectedDateRange({ start, end });
  }

  function handleEndDateChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const start = ev.target.dataset.start;
    const end = ev.target.dataset.end || ev.target.value;
    setSelectedDateRange({ start, end });
  }

  function handleCaseAssignment(assignment: AssignAttorneyModalCallbackProps) {
    const assignments: CaseAssignment[] = [];

    for (const attorney of assignment.selectedAttorneyList) {
      assignments.push({
        userId: attorney.id,
        name: attorney.name,
        role: CamsRole.TrialAttorney,
      } as CaseAssignment);
    }

    const updatedCaseBasicInfo: CaseDetail = {
      ...caseBasicInfo!,
      assignments,
      leadTrialAttorney: assignment.leadTrialAttorney,
    };

    setCaseBasicInfo(updatedCaseBasicInfo);
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
    setNavState(mapNavState(location.pathname));
    if (navState !== CaseNavState.COURT_DOCKET) {
      setSelectedFacets([]);
    }
  }, [location]);

  const { filteredDocketEntries, docketAlertOptions } = applyDocketEntrySortAndFilters(
    caseDocketEntries,
    {
      searchInDocketText,
      selectedFacets,
      sortDirection: docketSortDirection,
      documentNumber,
      selectedDateRange,
    },
  );

  return (
    <MainContent className="record-detail" data-testid="case-detail">
      <DocumentTitle name="Case Detail" />
      {isLoading && (
        <>
          <CaseDetailHeader isLoading={isLoading} caseId={caseId} />
          <div className="grid-row grid-gap-lg">
            <div className="grid-col-2 case-detail-navigation-column">
              <CaseDetailNavigation
                caseId={caseId}
                initiallySelectedNavLink={navState}
                showAssociatedCasesList={false}
              />
            </div>
            <div className="grid-col-10">
              <LoadingSpinner id="case-detail-loading-spinner" caption="Loading case details..." />
            </div>
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
          {caseBasicInfo.movedToCaseId && (
            <div
              className="usa-alert usa-alert--warning"
              role="alert"
              data-testid="case-moved-alert"
            >
              <div className="usa-alert__body">
                <h4 className="usa-alert__heading">Case Division Changed</h4>
                <p className="usa-alert__text">
                  This case was moved to a different division.{' '}
                  <Link to={`/case-detail/${caseBasicInfo.movedToCaseId}`}>
                    View the current case
                  </Link>
                </p>
              </div>
            </div>
          )}
          <div className="grid-row grid-gap-lg">
            <div className="grid-col-2 left-navigation-column">
              <div className="left-navigation-pane-container">
                <CaseDetailNavigation
                  caseId={caseId}
                  initiallySelectedNavLink={navState}
                  showAssociatedCasesList={
                    (caseBasicInfo.consolidation !== undefined &&
                      caseBasicInfo.consolidation.length > 0) ||
                    (caseBasicInfo.transfers !== undefined && caseBasicInfo.transfers.length > 0)
                  }
                />
                {hasDocketEntries && navState === CaseNavState.COURT_DOCKET && (
                  <div
                    className={`filter-and-search padding-y-4`}
                    data-testid="filter-and-search-panel"
                    aria-live="polite"
                  >
                    <h3 className="filter-header" aria-label="Court Docket Filters">
                      Filters
                    </h3>
                    <div className="filter-info-text">
                      As filters are applied, docket entries will be sorted or filtered
                      automatically.
                    </div>
                    <div className="sort form-field">
                      <div className="usa-sort usa-sort--small">
                        <button
                          className="usa-button usa-button--outline sort-button"
                          id="basic-sort-button"
                          name="basic-sort"
                          onClick={toggleDocketSort}
                          data-testid="docket-entry-sort"
                          aria-label={'Sort ' + docketSortDirection + ' First'}
                        >
                          <div aria-hidden="true">
                            <span aria-hidden="true">Sort ({docketSortDirection})</span>
                            <Icon
                              className="sort-button-icon"
                              name={
                                docketSortDirection === 'Newest' ? 'arrow_upward' : 'arrow_downward'
                              }
                            />
                          </div>
                        </button>
                      </div>
                    </div>
                    <div className="in-docket-search form-field" data-testid="docket-entry-search">
                      <div className="usa-search usa-search--small">
                        <Input
                          className="search-icon"
                          id="basic-search-field"
                          name="basic-search"
                          label="Find text in Docket"
                          aria-label="Find text in Docket entries. Results will be updated while you type."
                          aria-live="polite"
                          icon="search"
                          position="right"
                          autoComplete="off"
                          onChange={searchDocketText}
                          ref={findInDocketRef}
                        />
                      </div>
                    </div>
                    <div
                      className="docket-summary-facets form-field"
                      data-testid="facet-multi-select-container-test-id"
                    >
                      <ComboBox
                        id="facet-multi-select"
                        options={getSummaryFacetList(caseDocketSummaryFacets)}
                        onClose={handleSelectedFacet}
                        onUpdateSelection={handleFacetClear}
                        label="Filter by Summary"
                        ariaDescription="Select multiple options. Results will update when the dropdown is closed."
                        aria-live="off"
                        multiSelect={true}
                        singularLabel="summary"
                        pluralLabel="summaries"
                        ref={facetPickerRef}
                      />
                    </div>
                    <div className="in-docket-search form-field" data-testid="docket-date-range">
                      <DateRangePicker
                        id="docket-date-range"
                        ariaDescription="Find Docket entries that fall within date range. Results will be updated as your selection is made."
                        aria-live="polite"
                        startDateLabel="Docket Date Range Start"
                        endDateLabel="Docket Date Range End"
                        onStartDateChange={handleStartDateChange}
                        onEndDateChange={handleEndDateChange}
                        min={DEFAULT_MIN_DATE}
                        ref={dateRangeRef}
                      ></DateRangePicker>
                    </div>
                    <div className="in-docket-search form-field" data-testid="docket-number-search">
                      <div className="usa-search usa-search--small">
                        <Input
                          id="document-number-search-field"
                          title="Enter numbers only"
                          className="search-icon"
                          type="text"
                          errorMessage={documentNumberError ? 'Please enter a number.' : undefined}
                          name="search-by-document-number"
                          label="Go to Document Number"
                          aria-label="Go to specific Document Number.  Results will be updated while you type."
                          aria-live="polite"
                          icon="search"
                          position="right"
                          autoComplete="off"
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
                        onClick={clearDocketFilters}
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
            <div className="grid-col-10 record-detail-content" aria-live="polite">
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  <Route
                    index
                    element={
                      <CaseDetailOverview
                        caseDetail={caseBasicInfo}
                        showReopenDate={showReopenDate(
                          caseBasicInfo?.reopenedDate,
                          caseBasicInfo?.closedDate,
                        )}
                      />
                    }
                  />
                  <Route
                    path="trustee-and-assigned-staff"
                    element={
                      <CaseDetailTrusteeAndAssignedStaff
                        caseDetail={caseBasicInfo}
                        onCaseAssignment={handleCaseAssignment}
                      />
                    }
                  />
                  <Route
                    path="trustee"
                    element={
                      showTrusteeTab ? (
                        <CaseDetailTrusteePanel caseDetail={caseBasicInfo} />
                      ) : (
                        <Navigate to={`/case-detail/${caseBasicInfo.caseId}/`} replace />
                      )
                    }
                  />
                  <Route
                    path="court-docket"
                    element={
                      <CaseDetailCourtDocket
                        caseId={caseBasicInfo.caseId}
                        docketEntries={filteredDocketEntries}
                        alertOptions={docketAlertOptions}
                        searchString={searchInDocketText}
                        hasDocketEntries={!!caseDocketEntries && caseDocketEntries?.length > 1}
                        isDocketLoading={isDocketLoading}
                      />
                    }
                  />
                  <Route
                    path="audit-history"
                    element={<CaseDetailAuditHistory caseId={caseId ?? ''} />}
                  />
                  <Route
                    path="associated-cases"
                    element={
                      <CaseDetailAssociatedCases
                        caseDetail={caseBasicInfo}
                        associatedCases={associatedCases}
                        isAssociatedCasesLoading={isAssociatedCasesLoading}
                      />
                    }
                  />
                  <Route path="notes" element={<CaseNotes caseId={caseId ?? ''} />} />
                </Routes>
              </Suspense>
              <Outlet />
            </div>
          </div>
        </>
      )}
    </MainContent>
  );
}
