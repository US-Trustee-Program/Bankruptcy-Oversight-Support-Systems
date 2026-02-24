import { useEffect, useState, type JSX } from 'react';
import { useTrackEvent } from '@microsoft/applicationinsights-react-js';
import { CaseSummary, SyncedCase } from '@common/cams/cases';
import Table, { TableBody, TableRowProps } from '@/lib/components/uswds/Table';
import { CasesSearchPredicate } from '@common/api/search';

import Alert, { AlertDetails, AlertProps, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { CamsHttpError } from '@/lib/models/api';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { Pagination } from '@/lib/components/uswds/Pagination';
import Api2 from '@/lib/models/api2';
import { ResponseBody } from '@common/api/response';
import './SearchResults.scss';
import { Pagination as PaginationModel } from '@common/api/pagination';
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
};

export type SearchResultsRowProps = TableRowProps & {
  idx: number;
  bCase: CaseSummary;
  labels: string[];
  phoneticSearchEnabled?: boolean;
  showDebtorNameColumn?: boolean;
};

export type SearchResultsProps = JSX.IntrinsicElements['table'] & {
  id: string;
  searchPredicate: CasesSearchPredicate;
  phoneticSearchEnabled?: boolean;
  showDebtorNameColumn?: boolean;
  onStartSearching?: () => void;
  onEndSearching?: () => void;
  noResultsMessage?: string;
  noResultsAlertProps?: AlertProps;
  header: (props: SearchResultsHeaderProps) => JSX.Element;
  row: (props: SearchResultsRowProps) => JSX.Element;
};

function SearchResults(props: SearchResultsProps) {
  const {
    id,
    searchPredicate: searchPredicateProp,
    phoneticSearchEnabled = false,
    showDebtorNameColumn = false,
    onStartSearching,
    onEndSearching,
    noResultsMessage: noResultsMessageProp,
    noResultsAlertProps,
    header: Header,
    row: Row,
    ...otherProps
  } = props;
  const { reactPlugin } = getAppInsights();
  const trackSearchEvent = useTrackEvent(reactPlugin, 'search', {}, true);
  const [searchPredicate, setSearchPredicate] = useState<CasesSearchPredicate>({});
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [emptyResponse, setEmptyResponse] = useState<boolean>(true);
  const [alertInfo, setAlertInfo] = useState<AlertDetails | null>(null);
  const [searchResults, setSearchResults] = useState<ResponseBody<SyncedCase[]> | null>(null);

  const searchResultsHeaderLabels = showDebtorNameColumn
    ? ['Case Number (Division)', 'Case Title', 'Debtor Name', 'Chapter', 'Case Filed']
    : ['Case Number (Division)', 'Case Title', 'Chapter', 'Case Filed'];

  const pagination: PaginationModel | undefined = searchResults?.pagination;

  const noResultsMessage =
    noResultsMessageProp ?? 'Modify your search criteria to include more cases.';

  function handleSearchResults(response: ResponseBody<SyncedCase[]> | void) {
    if (response) {
      setSearchResults(response);
      setEmptyResponse(response.data.length === 0);
    } else {
      setSearchResults(null);
      setEmptyResponse(true);
    }
  }

  function handleSearchError(error: unknown) {
    setSearchResults(null);
    setEmptyResponse(true);
    const isTimeout = error instanceof CamsHttpError && error.status === 504;
    const persistentIssueMessage =
      'If the problem persists, please submit a feedback request describing the issue.';
    setAlertInfo({
      type: UswdsAlertStyle.Error,
      title: isTimeout ? 'Unable to display search results' : 'Search results not available',
      message: isTimeout
        ? `Try narrowing your search filters and try again. ${persistentIssueMessage}`
        : `We are unable to retrieve search results at this time. Please try again later. ${persistentIssueMessage}`,
      timeOut: 30,
    });
  }

  function resetAlert() {
    setAlertInfo(null);
  }

  function search() {
    if (!isValidSearchPredicate(searchPredicate)) {
      return;
    }
    resetAlert();

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
    Api2.searchCases(searchPredicate, { includeAssignments: true })
      .then(handleSearchResults)
      .catch(handleSearchError)
      .finally(() => {
        setIsSearching(false);
        if (onEndSearching) {
          onEndSearching();
        }
      });
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

  const totalCount = searchResults?.pagination?.totalCount ?? 0;
  const displayCount = new Intl.NumberFormat('en-US').format(totalCount);

  return (
    <div {...otherProps} className="search-results">
      {alertInfo && (
        <div className="search-alert">
          <Alert
            id="search-error-alert"
            className="measure-6"
            message={alertInfo.message}
            title={alertInfo.title}
            type={UswdsAlertStyle.Error}
            show={true}
            inline={true}
            role="alert"
            compact={true}
          ></Alert>
        </div>
      )}
      {!isSearching && emptyResponse && !alertInfo && !noResultsAlertProps && (
        <div className="search-alert">
          <Alert
            id="no-results-alert"
            className="measure-6"
            message={noResultsMessage}
            title="No cases found"
            type={UswdsAlertStyle.Info}
            show={true}
            inline={true}
            role="alert"
            compact={true}
          ></Alert>
        </div>
      )}
      {!isSearching && emptyResponse && noResultsAlertProps && (
        <div className="search-alert">
          <Alert {...noResultsAlertProps} id="no-results-alert" className="measure-6"></Alert>
        </div>
      )}
      {isSearching && (
        <LoadingSpinner aria-label="Searching" role="status" caption="Searching..." />
      )}
      {!isSearching && !emptyResponse && (
        <div>
          <Table
            id={id}
            className="case-list"
            scrollable="true"
            uswdsStyle={['striped']}
            title="Search results"
            caption={`${displayCount} ${totalCount === 1 ? 'case' : 'cases'}`}
          >
            <Header
              id={id}
              labels={searchResultsHeaderLabels}
              phoneticSearchEnabled={phoneticSearchEnabled}
              showDebtorNameColumn={showDebtorNameColumn}
            />
            <TableBody id={id}>
              {searchResults?.data.map((bCase, idx) => {
                return (
                  <Row
                    bCase={bCase}
                    labels={searchResultsHeaderLabels}
                    phoneticSearchEnabled={phoneticSearchEnabled}
                    showDebtorNameColumn={showDebtorNameColumn}
                    idx={idx}
                    key={idx}
                  />
                );
              })}
            </TableBody>
          </Table>
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
