import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { AlertDetails, AlertProps, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { Pagination } from '@/lib/components/uswds/Pagination';
import { Table, TableBody, TableRowProps } from '@/lib/components/uswds/Table';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { useAppInsights } from '@/lib/hooks/UseApplicationInsights';
import { deepEqual } from '@/lib/utils/objectEquality';
import { Pagination as PaginationModel } from '@common/api/pagination';
import { ResponseBody } from '@common/api/response';
import { CasesSearchPredicate } from '@common/api/search';
import { CaseBasics, SyncedCase } from '@common/cams/cases';
import { useTrackEvent } from '@microsoft/applicationinsights-react-js';

import './SearchResults.scss';

import { useEffect, useState } from 'react';

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

const searchResultsHeaderLabels = ['Case Number (Division)', 'Case Title', 'Chapter', 'Case Filed'];

export type SearchResultsHeaderProps = {
  id: string;
  labels: string[];
};

export type SearchResultsProps = JSX.IntrinsicElements['table'] & {
  header: (props: SearchResultsHeaderProps) => JSX.Element;
  id: string;
  noResultsAlertProps?: AlertProps;
  noResultsMessage?: string;
  onEndSearching?: () => void;
  onStartSearching?: () => void;
  row: (props: SearchResultsRowProps) => JSX.Element;
  searchPredicate: CasesSearchPredicate;
};

export type SearchResultsRowProps = TableRowProps & {
  bCase: CaseBasics;
  idx: number;
  labels: string[];
};

export function SearchResults(props: SearchResultsProps) {
  const {
    header: Header,
    id,
    noResultsAlertProps,
    noResultsMessage: noResultsMessageProp,
    onEndSearching,
    onStartSearching,
    row: Row,
    searchPredicate: searchPredicateProp,
    ...otherProps
  } = props;
  const { reactPlugin } = useAppInsights();
  const trackSearchEvent = useTrackEvent(reactPlugin, 'search', {}, true);
  const [searchPredicate, setSearchPredicate] = useState<CasesSearchPredicate>({});
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [emptyResponse, setEmptyResponse] = useState<boolean>(true);
  const [alertInfo, setAlertInfo] = useState<AlertDetails | null>(null);
  const [searchResults, setSearchResults] = useState<null | ResponseBody<SyncedCase[]>>(null);

  const pagination: PaginationModel | undefined = searchResults?.pagination;

  const noResultsMessage =
    noResultsMessageProp ?? 'Modify your search criteria to include more cases.';

  const api = useApi2();

  function handleSearchResults(response: ResponseBody<SyncedCase[]> | void) {
    if (response) {
      setSearchResults(response);
      setEmptyResponse(response.data.length === 0);
    } else {
      setSearchResults(null);
      setEmptyResponse(true);
    }
  }

  function handleSearchError() {
    setSearchResults(null);
    setEmptyResponse(true);
    setAlertInfo({
      message:
        'We are unable to retrieve search results at this time. Please try again later. If the problem persists, please submit a feedback request describing the issue.',
      timeOut: 30,
      title: 'Search Results Not Available',
      type: UswdsAlertStyle.Error,
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

    trackSearchEvent(searchPredicate);
    setIsSearching(true);
    if (onStartSearching) {
      onStartSearching();
    }
    api
      .searchCases(searchPredicate, { includeAssignments: true })
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
  return (
    <div {...otherProps} className="search-results">
      {alertInfo && (
        <div className="search-alert">
          <Alert
            className="measure-6"
            id="search-error-alert"
            inline={true}
            message={alertInfo.message}
            role="alert"
            show={true}
            slim={true}
            title={alertInfo.title}
            type={UswdsAlertStyle.Error}
          ></Alert>
        </div>
      )}
      {!isSearching && emptyResponse && !alertInfo && !noResultsAlertProps && (
        <div className="search-alert">
          <Alert
            className="measure-6"
            id="no-results-alert"
            inline={true}
            message={noResultsMessage}
            role="alert"
            show={true}
            slim={true}
            title="No cases found"
            type={UswdsAlertStyle.Info}
          ></Alert>
        </div>
      )}
      {!isSearching && emptyResponse && noResultsAlertProps && (
        <div className="search-alert">
          <Alert {...noResultsAlertProps} className="measure-6" id="no-results-alert"></Alert>
        </div>
      )}
      {isSearching && (
        <LoadingSpinner aria-label="Searching" caption="Searching..." role="status" />
      )}
      {!isSearching && !emptyResponse && (
        <div>
          <Table
            caption={`Search yielded ${new Intl.NumberFormat('en-US').format(totalCount)} ${totalCount === 1 ? 'result' : 'results'}.`}
            className="case-list"
            id={id}
            scrollable="true"
            title="search results."
            uswdsStyle={['striped']}
          >
            <Header id={id} labels={searchResultsHeaderLabels} />
            <TableBody id={id}>
              {searchResults?.data.map((bCase, idx) => {
                return <Row bCase={bCase} idx={idx} key={idx} labels={searchResultsHeaderLabels} />;
              })}
            </TableBody>
          </Table>
          {pagination && (
            <Pagination<CasesSearchPredicate>
              paginationValues={pagination}
              retrievePage={handlePagination}
              searchPredicate={searchPredicate}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default SearchResults;
