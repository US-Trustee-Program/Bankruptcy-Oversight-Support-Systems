import './CaseDetailScreen.scss';
import { lazy, Suspense, useState, useEffect, useRef, useImperativeHandle } from 'react';
import { Route, useParams, useLocation, Outlet, Routes } from 'react-router-dom';
import Api from '../lib/models/api';
import MockApi from '../lib/models/chapter15-mock.api.cases';
import {
  CaseDetailType,
  CaseDocketEntry,
  Chapter15CaseDetailsResponseData,
  Chapter15CaseDocketResponseData,
} from '@/lib/type-declarations/chapter-15';
import { mapNavState } from './panels/CaseDetailNavigation';
import { CaseDetailScrollPanelRef } from './panels/CaseDetailScrollPanelRef';
import ReactSelect, { MultiValue } from 'react-select';
import { CaseDocketSummaryFacets } from '@/case-detail/panels/CaseDetailCourtDocket';
import Icon from '@/lib/components/uswds/Icon';
import IconInput from '@/lib/components/IconInput';
import useFeatureFlags, { DOCKET_SEARCH_ENABLED } from '@/lib/hooks/UseFeatureFlags';
const LoadingIndicator = lazy(() => import('@/lib/components/LoadingIndicator'));
const CaseDetailHeader = lazy(() => import('./panels/CaseDetailHeader'));
const CaseDetailBasicInfo = lazy(() => import('./panels/CaseDetailBasicInfo'));
const CaseDetailNavigation = lazy(() => import('./panels/CaseDetailNavigation'));
const CaseDetailCourtDocket = lazy(() => import('./panels/CaseDetailCourtDocket'));

type SortDirection = 'Oldest' | 'Newest';

export function docketSorterClosure(sortDirection: SortDirection) {
  return (left: CaseDocketEntry, right: CaseDocketEntry) => {
    const direction = sortDirection === 'Newest' ? 1 : -1;
    return left.sequenceNumber < right.sequenceNumber ? direction : direction * -1;
  };
}

interface CaseDetailProps {
  caseDetail?: CaseDetailType;
  caseDocketEntries?: CaseDocketEntry[];
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
  return facetOptions;
}

export const CaseDetail = (props: CaseDetailProps) => {
  const { caseId } = useParams();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const api = import.meta.env['CAMS_PA11Y'] === 'true' ? MockApi : Api;
  const [caseBasicInfo, setCaseBasicInfo] = useState<CaseDetailType>();
  const [caseDocketEntries, setCaseDocketEntries] = useState<CaseDocketEntry[]>();
  const [caseDocketSummaryFacets, setCaseDocketSummaryFacets] = useState<CaseDocketSummaryFacets>(
    new Map(),
  );
  const [selectedFacets, setSelectedFacets] = useState<string[]>([]);
  const [searchString, setSearchString] = useState('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('Newest');
  const leftNavContainerRef = useRef<CaseDetailScrollPanelRef>(null);

  const location = useLocation();
  const [leftNavContainerFixed, setLeftNavContainerFixed] = useState<string>('');
  const navState = mapNavState(location.pathname);

  const hasDocketEntries = caseDocketEntries && !!caseDocketEntries.length;

  const flags = useFeatureFlags();
  const searchFeature = flags[DOCKET_SEARCH_ENABLED];

  const fetchCaseBasicInfo = async () => {
    setIsLoading(true);
    api.get(`/cases/${caseId}`, {}).then((data) => {
      const response = data as Chapter15CaseDetailsResponseData;
      setCaseBasicInfo(response.body?.caseDetails);
      setIsLoading(false);
    });
  };

  const fetchCaseDocketEntries = async () => {
    api
      .get(`/cases/${caseId}/docket`, {})
      .then((data) => {
        const response = data as Chapter15CaseDocketResponseData;
        setCaseDocketEntries(response.body);
        const facets = response.body.reduce<CaseDocketSummaryFacets>(
          (acc: CaseDocketSummaryFacets, de: CaseDocketEntry) => {
            if (acc.has(de.summaryText)) {
              const facet = acc.get(de.summaryText)!;
              facet.count = facet.count + 1;
              acc.set(de.summaryText, facet);
            } else {
              acc.set(de.summaryText, { text: de.summaryText, count: 1 });
            }
            return acc;
          },
          new Map(),
        );
        setCaseDocketSummaryFacets(facets);
      })
      .catch(() => {
        setCaseDocketEntries([]);
      });
  };

  function toggleSort() {
    setSortDirection(sortDirection === 'Newest' ? 'Oldest' : 'Newest');
  }

  function search(ev: React.ChangeEvent<HTMLInputElement>) {
    const searchString = ev.target.value.toLowerCase();
    setSearchString(searchString);
  }

  const handleSelectedFacet = (newValue: MultiValue<Record<string, string>>) => {
    const selected: string[] = [];
    newValue.forEach((value) => {
      const { value: selection } = value;
      selected.push(selection);
    });
    setSelectedFacets(selected);
  };

  function docketSearchFilter(docketEntry: CaseDocketEntry) {
    return (
      docketEntry.summaryText.toLowerCase().includes(searchString) ||
      docketEntry.fullText.toLowerCase().includes(searchString)
    );
  }

  function facetFilter(docketEntry: CaseDocketEntry) {
    if (selectedFacets.length === 0) return docketEntry;
    return selectedFacets.includes(docketEntry.summaryText);
  }

  function applySortAndFilters(docketEntries: CaseDocketEntry[] | undefined) {
    if (docketEntries === undefined) return;
    return docketEntries
      .filter(docketSearchFilter)
      .filter(facetFilter)
      .sort(docketSorterClosure(sortDirection));
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
    } else {
      fetchCaseDocketEntries();
    }
  }, []);

  useImperativeHandle(leftNavContainerRef, () => ({
    fix: () => setLeftNavContainerFixed('grid-col-2 fixed'),
    loosen: () => setLeftNavContainerFixed(''),
  }));

  return (
    <>
      <div className="case-detail">
        {isLoading && (
          <>
            <CaseDetailHeader
              isLoading={isLoading}
              navigationPaneRef={leftNavContainerRef as React.RefObject<CaseDetailScrollPanelRef>}
              caseId={caseId}
            />
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-2">
                <CaseDetailNavigation caseId={caseId} initiallySelectedNavLink={navState} />
              </div>
              <div className="grid-col-8">
                <LoadingIndicator />
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
              navigationPaneRef={leftNavContainerRef as React.RefObject<CaseDetailScrollPanelRef>}
            />
            <div className="grid-row grid-gap-lg">
              <div id="left-gutter" className="grid-col-1"></div>
              <div className="grid-col-2">
                <div className={'left-navigation-pane-container ' + leftNavContainerFixed}>
                  <CaseDetailNavigation caseId={caseId} initiallySelectedNavLink={navState} />
                  {hasDocketEntries && searchFeature && (
                    <div className={`filter-and-search padding-y-4`}>
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
                            onChange={search}
                          />
                        </div>
                      </div>

                      <div className="docket-summary-facets form-field">
                        <label>Filter</label>
                        <ReactSelect
                          options={getSummaryFacetList(caseDocketSummaryFacets)}
                          isMulti
                          closeMenuOnSelect={false}
                          onChange={handleSelectedFacet}
                        ></ReactSelect>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid-col-6">
                <Suspense fallback={<LoadingIndicator />}>
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
                          docketEntries={applySortAndFilters(caseDocketEntries)}
                          searchString={searchString}
                          hasDocketEntries={caseDocketEntries && caseDocketEntries?.length > 1}
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
};

export default CaseDetail;
