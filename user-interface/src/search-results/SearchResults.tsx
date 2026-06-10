import { useEffect, useState, type JSX } from 'react';
import { useTrackEvent } from '@microsoft/applicationinsights-react-js';
import { CasesPagination, SyncedCase } from '@common/cams/cases';
import { CamsTable, CamsTableBody } from '@/lib/components/cams/CamsTable';
import { CasesSearchPredicate } from '@common/api/search';

import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { Pagination } from '@/lib/components/uswds/Pagination';
import Api2 from '@/lib/models/api2';
import { ResponseBody } from '@common/api/response';
import './SearchResults.scss';
import { deepEqual } from '@common/object-equality';

export function isValidSearchPredicate(searchPredicate: CasesSearchPredicate): boolean {
  if (Object.keys(searchPredicate).length === 0) {
    return false;
  }
  return Object.keys(searchPredicate).reduce((isIt, key) => {
    if (['limit', 'offset'].includes(key)) {
      return isIt;
    }
    return isIt || !!searchPredicate[key as keyof CasesSearchPredicate];
  }, false);
}

export type SearchResultsHeaderProps = {
  id: string;
  labels: string[];
  phoneticSearchEnabled?: boolean;
  showDebtorNameColumn?: boolean;
  showOpenClosedColumn?: boolean;
};

export type SearchResultsRowProps = {
  idx: number;
  rank?: number;
  bCase: SyncedCase;
  labels: string[];
  phoneticSearchEnabled?: boolean;
  showDebtorNameColumn?: boolean;
  showOpenClosedColumn?: boolean;
  onCaseClick?: (bCase: SyncedCase, rank: number) => void;
};

export type SearchResultsProps = {
  id: string;
  searchPredicate: CasesSearchPredicate;
  phoneticSearchEnabled?: boolean;
  showDebtorNameColumn?: boolean;
  showOpenClosedColumn?: boolean;
  onStartSearching?: () => void;
  onEndSearching?: () => void;
  onResultsChanged?: (hasResults: boolean, closedCasesCount?: number) => void;
  onSearchError?: (error: unknown) => void;
  header: (props: SearchResultsHeaderProps) => JSX.Element;
  row: (props: SearchResultsRowProps) => JSX.Element;
};

function SearchResults(props: SearchResultsProps) {
  const {
    id,
    searchPredicate: searchPredicateProp,
    phoneticSearchEnabled = false,
    showDebtorNameColumn = false,
    showOpenClosedColumn = false,
    onStartSearching,
    onEndSearching,
    onResultsChanged,
    onSearchError,
    header: Header,
    row: Row,
  } = props;
  const { reactPlugin } = getAppInsights();
  const trackSearchEvent = useTrackEvent(reactPlugin, 'search', {}, true);
  const [searchPredicate, setSearchPredicate] = useState<CasesSearchPredicate>({});
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [emptyResponse, setEmptyResponse] = useState<boolean>(true);
  const [searchResults, setSearchResults] = useState<ResponseBody<SyncedCase[]> | null>(null);

  const searchResultsHeaderLabels = (() => {
    const labels = ['Case Number (Division)', 'Case Title'];
    if (showDebtorNameColumn) labels.push('Debtor Name');
    labels.push('Chapter', 'Case Filed');
    if (showOpenClosedColumn) labels.push('Open/Closed');
    return labels;
  })();

  const pagination = searchResults?.pagination;

  function handleSearchResults(response: ResponseBody<SyncedCase[]> | void) {
    if (response) {
      setSearchResults(response);
      setEmptyResponse(response.data.length === 0);
      onResultsChanged?.(
        response.data.length > 0,
        (response.pagination as CasesPagination | undefined)?.closedCasesCount,
      );
    } else {
      setSearchResults(null);
      setEmptyResponse(true);
      onResultsChanged?.(false);
    }
  }

  function search() {
    if (!isValidSearchPredicate(searchPredicate)) {
      return;
    }

    const searchMetadata = {
      ...searchPredicate,
      debtorNameUsed: !!searchPredicate.debtorName,
    };
    if ('debtorName' in searchMetadata) {
      delete searchMetadata.debtorName;
    }
    trackSearchEvent(searchMetadata);
    setIsSearching(true);
    if (onStartSearching) {
      onStartSearching();
    }
    const searchStart = performance.now();
    const { excludeClosedCases } = searchPredicate;
    Api2.searchCases(searchPredicate, { includeAssignments: true })
      .then((response) => {
        getAppInsights().appInsights.trackEvent(
          { name: 'Case Search Performance' },
          {
            durationMs: Math.round(performance.now() - searchStart),
            excludeClosedCases: excludeClosedCases ?? true,
          },
        );
        handleSearchResults(response);
      })
      .catch(handleSearchError)
      .finally(() => {
        setIsSearching(false);
        if (onEndSearching) {
          onEndSearching();
        }
      });
  }

  function handleCaseClick(bCase: SyncedCase, rank: number) {
    if (!searchPredicate.debtorName || !bCase.searchMetadata) return;

    const { matchScore, matchTypes, scoreBreakdown } = bCase.searchMetadata;
    const cap = Math.min(rank - 1, 5);
    // Only includes results from the current page; earlier pages are not retained after navigation.
    const higherRankedOnPage = (searchResults?.data ?? [])
      .slice(0, cap)
      .filter((r) => r.searchMetadata !== undefined)
      .map((r, i) => ({
        rank: (searchPredicate.offset ?? 0) + i + 1,
        matchScore: r.searchMetadata!.matchScore,
        matchTypes: r.searchMetadata!.matchTypes,
      }));

    getAppInsights().appInsights.trackEvent(
      { name: 'searchResultClick' },
      {
        rank,
        matchScore,
        matchTypes: JSON.stringify(matchTypes),
        scoreBreakdown: JSON.stringify(scoreBreakdown),
        chapters: searchPredicate.chapters ? JSON.stringify(searchPredicate.chapters) : undefined,
        divisionCodes: searchPredicate.divisionCodes
          ? JSON.stringify(searchPredicate.divisionCodes)
          : undefined,
        excludeClosedCases: searchPredicate.excludeClosedCases,
        higherRankedResults: JSON.stringify(higherRankedOnPage),
      },
    );
  }

  function handleSearchError(error: unknown) {
    onSearchError?.(error);
  }

  function handlePagination(predicate: CasesSearchPredicate) {
    setSearchPredicate(predicate);
  }

  useEffect(() => {
    if (!deepEqual(searchPredicateProp, searchPredicate)) {
      setSearchPredicate(searchPredicateProp);
    }
  }, [searchPredicateProp]);

  useEffect(() => {
    search();
  }, [searchPredicate]);

  const totalCount = searchResults?.pagination?.totalCount ?? searchResults?.data?.length ?? 0;
  const displayCount = new Intl.NumberFormat('en-US').format(totalCount);

  return (
    <div className="search-results">
      {isSearching && (
        <LoadingSpinner aria-label="Searching" role="status" caption="Searching..." />
      )}
      {!isSearching && !emptyResponse && (
        <div>
          <CamsTable
            id={id}
            className="case-list"
            aria-label="Search results"
            caption={`${displayCount} ${totalCount === 1 ? 'case' : 'cases'}`}
          >
            <Header
              id={id}
              labels={searchResultsHeaderLabels}
              phoneticSearchEnabled={phoneticSearchEnabled}
              showDebtorNameColumn={showDebtorNameColumn}
              showOpenClosedColumn={showOpenClosedColumn}
            />
            <CamsTableBody>
              {searchResults?.data.map((bCase, idx) => {
                return (
                  <Row
                    bCase={bCase}
                    labels={searchResultsHeaderLabels}
                    phoneticSearchEnabled={phoneticSearchEnabled}
                    showDebtorNameColumn={showDebtorNameColumn}
                    showOpenClosedColumn={showOpenClosedColumn}
                    idx={idx}
                    rank={(searchPredicate.offset ?? 0) + idx + 1}
                    onCaseClick={handleCaseClick}
                    key={idx}
                  />
                );
              })}
            </CamsTableBody>
          </CamsTable>
          {pagination && (
            <Pagination<CasesSearchPredicate>
              paginationValues={pagination}
              searchPredicate={searchPredicate}
              retrievePage={handlePagination}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default SearchResults;
