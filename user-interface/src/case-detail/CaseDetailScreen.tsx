import { CaseDocketSummaryFacets } from '@/case-detail/panels/CaseDetailCourtDocket';
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import DateRangePicker from '@/lib/components/uswds/DateRangePicker';
import Icon from '@/lib/components/uswds/Icon';
import Input from '@/lib/components/uswds/Input';
import { useApi2 } from '@/lib/hooks/UseApi2';
import useFeatureFlags, { CASE_NOTES_ENABLED } from '@/lib/hooks/UseFeatureFlags';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import {
  ComboBoxRef,
  DateRange,
  DateRangePickerRef,
  InputRef,
} from '@/lib/type-declarations/input-fields';
import { AssignAttorneyModalCallbackProps } from '@/staff-assignment/modal/assignAttorneyModal.types';

import './CaseDetailScreen.scss';

import { CaseAssignment } from '@common/cams/assignments';
import { CaseDetail, CaseDocket, CaseDocketEntry, CaseNote } from '@common/cams/cases';
import { EventCaseReference } from '@common/cams/events';
import { CamsRole } from '@common/cams/roles';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';

import CaseNotes, { CaseNotesRef } from './panels/case-notes/CaseNotes';
import CaseDetailAssociatedCases from './panels/CaseDetailAssociatedCases';
import CaseDetailAuditHistory from './panels/CaseDetailAuditHistory';
import CaseDetailNavigation, { mapNavState, NavState } from './panels/CaseDetailNavigation';

const CaseDetailHeader = lazy(() => import('./panels/CaseDetailHeader'));
const CaseDetailOverview = lazy(() => import('./panels/CaseDetailOverview'));
const CaseDetailCourtDocket = lazy(() => import('./panels/CaseDetailCourtDocket'));

export interface CaseDetailProps {
  associatedCases?: EventCaseReference[];
  caseDetail?: CaseDetail;
  caseDocketEntries?: CaseDocketEntry[];
  caseNotes?: CaseNote[];
}

interface caseNoteSortAndFilterOptions {
  caseNoteSearchText: string;
  sortDirection: SortDirection;
}

interface DocketLimits {
  dateRange: DateRange;
  documentRange: DocumentRange;
}

interface docketSortAndFilterOptions {
  documentNumber: null | number;
  searchInDocketText: string;
  selectedDateRange: DateRange;
  selectedFacets: string[];
  sortDirection: SortDirection;
}

interface DocumentRange {
  first: number;
  last: number;
}

type SortDirection = 'Newest' | 'Oldest';

export function applyCaseNoteSortAndFilters(
  caseNotes: CaseNote[],
  options: caseNoteSortAndFilterOptions,
) {
  if (!caseNotes?.length) {
    return { filteredCaseNotes: caseNotes, notesAlertOptions: undefined };
  } else {
    const searchFilteredCaseNotes = caseNotes.filter((caseNote) =>
      notesSearchFilter(caseNote, options.caseNoteSearchText),
    );
    const notesAlertOptions =
      searchFilteredCaseNotes?.length === 0
        ? {
            message: "The search criteria didn't match any notes in this case",
            title: 'Case Note Not Found',
            type: UswdsAlertStyle.Warning,
          }
        : undefined;
    const filteredCaseNotes = searchFilteredCaseNotes.sort(
      notesSorterClosure(options.sortDirection),
    );
    return { filteredCaseNotes, notesAlertOptions };
  }
}

export function applyDocketEntrySortAndFilters(
  docketEntries: CaseDocketEntry[] | undefined,
  options: docketSortAndFilterOptions,
) {
  if (docketEntries === undefined) {
    return { alertOptions: undefined, filteredDocketEntries: docketEntries };
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
    return { docketAlertOptions, filteredDocketEntries };
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
    return { docketAlertOptions: undefined, filteredDocketEntries };
  }
}

export default function CaseDetailScreen(props: CaseDetailProps) {
  const featureFlags = useFeatureFlags();
  const caseNotesEnabledFlag = featureFlags[CASE_NOTES_ENABLED];
  const { caseId } = useParams();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDocketLoading, setIsDocketLoading] = useState<boolean>(false);
  const [areCaseNotesLoading, setAreCaseNotesLoading] = useState<boolean>(false);
  const [isAssociatedCasesLoading, setIsAssociatedCasesLoading] = useState<boolean>(false);
  const api = useApi2();
  const [caseBasicInfo, setCaseBasicInfo] = useState<CaseDetail>();
  const [caseDocketEntries, setCaseDocketEntries] = useState<CaseDocketEntry[]>();
  const [caseNotes, setCaseNotes] = useState<CaseNote[]>([]);
  const [caseDocketSummaryFacets, setCaseDocketSummaryFacets] = useState<CaseDocketSummaryFacets>(
    new Map(),
  );
  const [associatedCases, setAssociatedCases] = useState<EventCaseReference[]>([]);
  const [selectedFacets, setSelectedFacets] = useState<string[]>([]);
  const [searchInDocketText, setSearchInDocketText] = useState('');
  const [caseNoteSearchText, setCaseNoteSearchText] = useState('');
  const [documentNumber, setDocumentNumber] = useState<null | number>(null);
  const [docketSortDirection, setDocketSortDirection] = useState<SortDirection>('Newest');
  const [notesSortDirection, setNotesSortDirection] = useState<SortDirection>('Newest');
  const location = useLocation();
  const [navState, setNavState] = useState<number>(mapNavState(location.pathname));
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange>({});
  const [documentRange, setDocumentRange] = useState<DocumentRange>({ first: 0, last: 0 });
  const [documentNumberError, setDocumentNumberError] = useState<boolean>(false);
  const findInDocketRef = useRef<InputRef>(null);
  const caseNoteTitleSearchRef = useRef<InputRef>(null);
  const findByDocketNumberRef = useRef<InputRef>(null);
  const dateRangeRef = useRef<DateRangePickerRef>(null);
  const facetPickerRef = useRef<ComboBoxRef>(null);
  const caseNotesRef = useRef<CaseNotesRef>(null);
  let hasDocketEntries = caseDocketEntries && !!caseDocketEntries.length;
  const hasCaseNotes = caseNotes && !!caseNotes.length;

  const globalAlert = useGlobalAlert();

  async function fetchCaseBasicInfo() {
    setIsLoading(true);
    api
      .getCaseDetail(caseId!)
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
    api
      .getCaseDocket(caseId!)
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

  async function fetchCaseNotes(noteId?: string) {
    setAreCaseNotesLoading(true);
    api
      .getCaseNotes(caseId!)
      .then((response) => {
        setCaseNotes(response.data);
        if (noteId) {
          caseNotesRef.current?.focusEditButton(noteId);
        }
      })
      .catch(() => {
        globalAlert?.error('Could not retrieve case notes.');
        setCaseNotes([]);
      })
      .finally(() => setAreCaseNotesLoading(false));
  }

  async function fetchAssociatedCases() {
    setIsAssociatedCasesLoading(true);
    api
      .getCaseAssociations(caseId!)
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

  function toggleNotesSort() {
    setNotesSortDirection(notesSortDirection === 'Newest' ? 'Oldest' : 'Newest');
  }

  function searchDocketText(ev: React.ChangeEvent<HTMLInputElement>) {
    const searchString = ev.target.value.toLowerCase();
    setSearchInDocketText(searchString);
  }

  function searchCaseNotesByTitle(ev: React.ChangeEvent<HTMLInputElement>) {
    const searchString = ev.target.value.toLowerCase();
    setCaseNoteSearchText(searchString);
  }

  function searchDocumentNumber(ev: React.ChangeEvent<HTMLInputElement>) {
    const newDocumentNumber = parseInt(ev.target.value.trim());
    if (isNaN(newDocumentNumber)) {
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
    setSelectedDateRange({ ...selectedDateRange, end: undefined, start: undefined });
    dateRangeRef.current?.clearValue();
    setSelectedFacets([]);
    facetPickerRef.current?.clearSelections();
    return;
  }

  function clearNotesFilters() {
    setCaseNoteSearchText('');
    caseNoteTitleSearchRef.current?.clearValue();
    return;
  }

  function handleFacetClear(values: ComboOption[]) {
    if (values.length === 0) {
      setSelectedFacets([]);
    }
  }

  function handleSelectedFacet(newValue: ComboOption[]) {
    const selected = (newValue as ComboOption[]).map((value: ComboOption) => {
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

  function handleCaseAssignment(assignment: AssignAttorneyModalCallbackProps) {
    const assignments: CaseAssignment[] = [];

    assignment.selectedAttorneyList.forEach((attorney) => {
      assignments.push({
        name: attorney.name,
        role: CamsRole.TrialAttorney,
        userId: attorney.id,
      } as CaseAssignment);
    });

    const updatedCaseBasicInfo: CaseDetail = {
      ...caseBasicInfo!,
      assignments,
    };

    setCaseBasicInfo(updatedCaseBasicInfo);
  }

  async function handleNotesCallback(noteId?: string) {
    fetchCaseNotes(noteId);
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
    if (props.caseNotes) {
      setCaseNotes(props.caseNotes);
    } else {
      fetchCaseNotes();
    }
  }, []);

  useEffect(() => {
    setNavState(mapNavState(location.pathname));
    if (navState !== NavState.COURT_DOCKET) {
      setSelectedFacets([]);
    }
  }, [location]);

  const { docketAlertOptions, filteredDocketEntries } = applyDocketEntrySortAndFilters(
    caseDocketEntries,
    {
      documentNumber,
      searchInDocketText,
      selectedDateRange,
      selectedFacets,
      sortDirection: docketSortDirection,
    },
  );

  const { filteredCaseNotes, notesAlertOptions } = applyCaseNoteSortAndFilters(caseNotes, {
    caseNoteSearchText,
    sortDirection: notesSortDirection,
  });

  return (
    <MainContent className="case-detail" data-testid="case-detail">
      <DocumentTitle name="Case Detail" />
      {isLoading && (
        <>
          <CaseDetailHeader caseId={caseId} isLoading={isLoading} />
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
              <LoadingSpinner caption="Loading case details..." id="case-detail-loading-spinner" />
            </div>
            <div className="grid-col-1"></div>
          </div>
        </>
      )}
      {!isLoading && caseBasicInfo && (
        <>
          <CaseDetailHeader
            caseDetail={caseBasicInfo}
            caseId={caseBasicInfo.caseId}
            isLoading={false}
          />
          <div className="grid-row grid-gap-lg">
            <div className="grid-col-1" id="left-gutter"></div>
            <div className="grid-col-2">
              <div className={'left-navigation-pane-container'}>
                <CaseDetailNavigation
                  caseId={caseId}
                  initiallySelectedNavLink={navState}
                  showAssociatedCasesList={
                    caseBasicInfo.consolidation !== undefined &&
                    caseBasicInfo.consolidation.length > 0
                  }
                />
                {hasDocketEntries && navState === NavState.COURT_DOCKET && (
                  <div
                    aria-live="polite"
                    className={`filter-and-search padding-y-4`}
                    data-testid="filter-and-search-panel"
                  >
                    <h3 aria-label="Court Docket Filters" className="filter-header">
                      Filters
                    </h3>
                    <div className="filter-info-text">
                      As filters are applied, docket entries will be sorted or filtered
                      automatically.
                    </div>
                    <div className="sort form-field">
                      <div className="usa-sort usa-sort--small">
                        <button
                          aria-label={'Sort ' + docketSortDirection + ' First'}
                          className="usa-button usa-button--outline sort-button"
                          data-testid="docket-entry-sort"
                          id="basic-sort-button"
                          name="basic-sort"
                          onClick={toggleDocketSort}
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
                          aria-label="Find text in Docket entries. Results will be updated while you type."
                          aria-live="polite"
                          autoComplete="off"
                          className="search-icon"
                          icon="search"
                          id="basic-search-field"
                          label="Find text in Docket"
                          name="basic-search"
                          onChange={searchDocketText}
                          position="right"
                          ref={findInDocketRef}
                        />
                      </div>
                    </div>
                    <div
                      className="docket-summary-facets form-field"
                      data-testid="facet-multi-select-container-test-id"
                    >
                      <ComboBox
                        aria-live="off"
                        ariaDescription="Select multiple options. Results will update when the dropdown is closed."
                        id="facet-multi-select"
                        label="Filter by Summary"
                        multiSelect={true}
                        onClose={handleSelectedFacet}
                        onUpdateSelection={handleFacetClear}
                        options={getSummaryFacetList(caseDocketSummaryFacets)}
                        pluralLabel="summaries"
                        ref={facetPickerRef}
                        singularLabel="summary"
                      />
                    </div>
                    <div className="in-docket-search form-field" data-testid="docket-date-range">
                      <DateRangePicker
                        aria-live="polite"
                        ariaDescription="Find Docket entries that fall within date range. Results will be updated as your selection is made."
                        endDateLabel="Docket Date Range End"
                        id="docket-date-range"
                        onEndDateChange={handleEndDateChange}
                        onStartDateChange={handleStartDateChange}
                        ref={dateRangeRef}
                        startDateLabel="Docket Date Range Start"
                      ></DateRangePicker>
                    </div>
                    <div className="in-docket-search form-field" data-testid="docket-number-search">
                      <div className="usa-search usa-search--small">
                        <Input
                          aria-label="Go to specific Document Number.  Results will be updated while you type."
                          aria-live="polite"
                          autoComplete="off"
                          className="search-icon"
                          errorMessage={
                            documentNumberError === true ? 'Please enter a number.' : undefined
                          }
                          icon="search"
                          id="document-number-search-field"
                          label="Go to Document Number"
                          max={documentRange.last}
                          min={documentRange.first}
                          name="search-by-document-number"
                          onChange={searchDocumentNumber}
                          position="right"
                          ref={findByDocketNumberRef}
                          title="Enter numbers only"
                          type="text"
                        />
                      </div>
                    </div>
                    <div className="form-field">
                      <button
                        aria-label="Clear All Filters"
                        className="usa-button usa-button--outline clear-filters-button"
                        data-testid="clear-filters"
                        id="clear-filters-button"
                        name="clear-filters"
                        onClick={clearDocketFilters}
                      >
                        <span aria-hidden="true">Clear All Filters</span>
                      </button>
                    </div>
                  </div>
                )}
                {hasCaseNotes && navState === NavState.CASE_NOTES && (
                  <div
                    aria-live="polite"
                    className={`filter-and-search padding-y-4`}
                    data-testid="case-notes-filter-and-search-panel"
                  >
                    <h3 aria-label="Case Note Filters" className="filter-header">
                      Filters
                    </h3>
                    <div className="filter-info-text">
                      As filters are applied, notes will be sorted or filtered automatically.
                    </div>
                    <div className="sort form-field">
                      <div className="usa-sort usa-sort--small">
                        <button
                          aria-label={'Sort ' + notesSortDirection + ' First'}
                          className="usa-button usa-button--outline sort-button"
                          data-testid="case-notes-sort"
                          id="basic-sort-button"
                          name="basic-sort"
                          onClick={toggleNotesSort}
                        >
                          <div aria-hidden="true">
                            <span aria-hidden="true">Sort ({notesSortDirection})</span>
                            <Icon
                              className="sort-button-icon"
                              name={
                                notesSortDirection === 'Newest' ? 'arrow_upward' : 'arrow_downward'
                              }
                            />
                          </div>
                        </button>
                      </div>
                    </div>
                    <div className="case-note-search form-field" data-testid="case-note-search">
                      <div className="usa-search usa-search--small">
                        <Input
                          aria-label="Find case notes by title or content. Results will be updated while you type."
                          aria-live="polite"
                          autoComplete="off"
                          className="search-icon"
                          icon="search"
                          id="case-note-search-input"
                          label="Find case note by title or content"
                          name="case-note-search-input"
                          onChange={searchCaseNotesByTitle}
                          position="right"
                          ref={caseNoteTitleSearchRef}
                        />
                      </div>
                    </div>
                    <div className="form-field">
                      <button
                        aria-label="Clear All Filters"
                        className="usa-button usa-button--outline clear-filters-button"
                        data-testid="clear-filters"
                        id="clear-filters-button"
                        name="clear-filters"
                        onClick={clearNotesFilters}
                      >
                        <span aria-hidden="true">Clear All Filters</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div aria-live="polite" className="grid-col-8">
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  <Route
                    element={
                      <CaseDetailOverview
                        caseDetail={caseBasicInfo}
                        onCaseAssignment={handleCaseAssignment}
                        showReopenDate={showReopenDate(
                          caseBasicInfo?.reopenedDate,
                          caseBasicInfo?.closedDate,
                        )}
                      />
                    }
                    index
                  />
                  <Route
                    element={
                      <CaseDetailCourtDocket
                        alertOptions={docketAlertOptions}
                        caseId={caseBasicInfo.caseId}
                        docketEntries={filteredDocketEntries}
                        hasDocketEntries={!!caseDocketEntries && caseDocketEntries?.length > 1}
                        isDocketLoading={isDocketLoading}
                        searchString={searchInDocketText}
                      />
                    }
                    path="court-docket"
                  />
                  <Route
                    element={<CaseDetailAuditHistory caseId={caseId ?? ''} />}
                    path="audit-history"
                  />
                  <Route
                    element={
                      <CaseDetailAssociatedCases
                        associatedCases={associatedCases}
                        isAssociatedCasesLoading={isAssociatedCasesLoading}
                      />
                    }
                    path="associated-cases"
                  />
                  {caseNotesEnabledFlag && (
                    <Route
                      element={
                        <CaseNotes
                          alertOptions={notesAlertOptions}
                          areCaseNotesLoading={areCaseNotesLoading}
                          caseId={caseId ?? ''}
                          caseNotes={filteredCaseNotes}
                          hasCaseNotes={hasCaseNotes}
                          onUpdateNoteRequest={handleNotesCallback}
                          ref={caseNotesRef}
                          searchString={caseNoteSearchText}
                        />
                      }
                      path="notes"
                    />
                  )}
                </Routes>
              </Suspense>
              <Outlet />
            </div>
            <div className="grid-col-1" id="right-gutter"></div>
          </div>
        </>
      )}
    </MainContent>
  );
}

export function docketSorterClosure(sortDirection: SortDirection) {
  return (left: CaseDocketEntry, right: CaseDocketEntry) => {
    const direction = sortDirection === 'Newest' ? 1 : -1;
    return left.sequenceNumber < right.sequenceNumber ? direction : direction * -1;
  };
}

export function findDocketLimits(docket: CaseDocket): DocketLimits {
  const dateRange: DateRange = { end: undefined, start: undefined };
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

export function getSummaryFacetList(facets: CaseDocketSummaryFacets) {
  const facetOptions = [...facets.entries()].map<ComboOption>(([key, facet]) => {
    return { label: `${key} (${facet.count})`, value: key };
  });
  return facetOptions.sort((a, b) => {
    if (a.label === b.label) return 0;
    return a.label < b.label ? -1 : 1;
  });
}

export function notesSorterClosure(sortDirection: SortDirection) {
  return (left: CaseNote, right: CaseNote) => {
    const direction = sortDirection === 'Newest' ? 1 : -1;
    return left.updatedOn < right.updatedOn ? direction : direction * -1;
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

function notesSearchFilter(note: CaseNote, searchString: string) {
  return (
    note.title.toLowerCase().includes(searchString) ||
    note.content.toLowerCase().includes(searchString)
  );
}

function showReopenDate(reOpenDate: string | undefined, closedDate: string | undefined) {
  if (reOpenDate && closedDate) {
    const parsedReOpenDate = Date.parse(reOpenDate);
    const parsedClosedDate = Date.parse(closedDate);
    if (closedDate && parsedReOpenDate > parsedClosedDate) {
      return true;
    }
  }
  return false;
}

function summaryTextFacetReducer(acc: CaseDocketSummaryFacets, de: CaseDocketEntry) {
  if (acc.has(de.summaryText)) {
    const facet = acc.get(de.summaryText)!;
    facet.count = facet.count + 1;
    acc.set(de.summaryText, facet);
  } else {
    acc.set(de.summaryText, { count: 1, text: de.summaryText });
  }
  return acc;
}
