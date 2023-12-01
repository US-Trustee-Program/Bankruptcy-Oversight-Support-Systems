import './CaseDetailScreen.scss';
import { lazy, Suspense, useState, useEffect, useRef } from 'react';
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
import { CaseDetailNavigationRef } from './panels/CaseDetailNavigation.d';
import ReactSelect, { MultiValue } from 'react-select';
import { CaseDocketSummaryFacets } from '@/case-detail/panels/CaseDetailCourtDocket';
const LoadingIndicator = lazy(() => import('@/lib/components/LoadingIndicator'));
const CaseDetailHeader = lazy(() => import('./panels/CaseDetailHeader'));
const CaseDetailBasicInfo = lazy(() => import('./panels/CaseDetailBasicInfo'));
const CaseDetailNavigation = lazy(() => import('./panels/CaseDetailNavigation'));
const CaseDetailCourtDocket = lazy(() => import('./panels/CaseDetailCourtDocket'));

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
  console.log(facetOptions);
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
  const navRef = useRef<CaseDetailNavigationRef>(null);
  const location = useLocation();

  const navState = mapNavState(location.pathname);

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

  useEffect(() => {
    if (props.caseDetail) {
      setCaseBasicInfo(props.caseDetail);
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

  const handleSelectedFacet = (newValue: MultiValue<Record<string, string>>) => {
    const selected: string[] = [];
    newValue.forEach((value) => {
      const { value: selection } = value;
      selected.push(selection);
    });
    setSelectedFacets(selected);
  };

  console.log(caseDocketSummaryFacets);

  return (
    <>
      <div className="case-detail">
        {isLoading && (
          <>
            <CaseDetailHeader
              isLoading={isLoading}
              navigationRef={navRef as React.RefObject<CaseDetailNavigationRef>}
              caseId={caseId}
            />
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-2">
                <CaseDetailNavigation
                  caseId={caseId}
                  initiallySelectedNavLink={navState}
                  ref={navRef}
                />
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
              navigationRef={navRef as React.RefObject<CaseDetailNavigationRef>}
            />
            <div className="grid-row grid-gap-lg">
              <div className="grid-col-1"></div>
              <div className="grid-col-2">
                <CaseDetailNavigation
                  caseId={caseId}
                  initiallySelectedNavLink={navState}
                  ref={navRef}
                />
                <div>
                  <ReactSelect
                    options={getSummaryFacetList(caseDocketSummaryFacets)}
                    isMulti
                    closeMenuOnSelect={false}
                    onChange={handleSelectedFacet}
                  ></ReactSelect>
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
                          docketEntries={caseDocketEntries}
                          facets={selectedFacets}
                        />
                      }
                    />
                  </Routes>
                </Suspense>
                <Outlet />
              </div>
              <div className="grid-col-2"></div>
              <div className="grid-col-1"></div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default CaseDetail;
