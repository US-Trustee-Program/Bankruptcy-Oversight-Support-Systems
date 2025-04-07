import { useEffect, useState } from 'react';
import { useTrackEvent } from '@microsoft/applicationinsights-react-js';
import { CaseBasics, SyncedCase } from '@common/cams/cases';
import { Table, TableBody, TableRowProps } from '@/lib/components/uswds/Table';
import { CasesSearchPredicate } from '@common/api/search';
import Alert, { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { useAppInsights } from '@/lib/hooks/UseApplicationInsights';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { Pagination } from '@/lib/components/uswds/Pagination';
import { deepEqual } from '@/lib/utils/objectEquality';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { ResponseBody } from '@common/api/response';
import './SearchResults.scss';
import { Pagination as PaginationModel } from '@common/api/pagination';

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

export type SearchResultsRowProps = TableRowProps & {
  idx: number;
  bCase: CaseBasics;
  labels: string[];
};

export type SearchResultsProps = JSX.IntrinsicElements['table'] & {
  id: string;
  searchPredicate: CasesSearchPredicate;
  onStartSearching?: () => void;
  onEndSearching?: () => void;
  noResultsMessage?: string;
  header: (props: SearchResultsHeaderProps) => JSX.Element;
  row: (props: SearchResultsRowProps) => JSX.Element;
};

export function SearchResults(props: SearchResultsProps) {
  const {
    id,
    searchPredicate: searchPredicateProp,
    onStartSearching,
    onEndSearching,
    noResultsMessage: noResultsMessageProp,
    header: Header,
    row: Row,
    ...otherProps
  } = props;
  const { reactPlugin } = useAppInsights();
  const trackSearchEvent = useTrackEvent(reactPlugin, 'search', {}, true);
  const [searchPredicate, setSearchPredicate] = useState<CasesSearchPredicate>({});
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [emptyResponse, setEmptyResponse] = useState<boolean>(true);
  const [alertInfo, setAlertInfo] = useState<AlertDetails | null>(null);
  const [searchResults, setSearchResults] = useState<ResponseBody<SyncedCase[]> | null>(null);

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
      type: UswdsAlertStyle.Error,
      title: 'Search Results Not Available',
      message:
        'We are unable to retrieve search results at this time. Please try again later. If the problem persists, please submit a feedback request describing the issue.',
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
    // TODO: FRITZ 04/07: THIS COMPONENT IS BEING REFRESHED AFTER ASSIGNMENT UPDATE but since
    // predicate hasn't changed, the rows are not refreshed.  This is what we want,
    // but the screen is being rerendered and thus, overwriting our inline changes
    // to the row assignments
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
            id="search-error-alert"
            className="measure-6"
            message={alertInfo.message}
            title={alertInfo.title}
            type={UswdsAlertStyle.Error}
            show={true}
            slim={true}
            inline={true}
            role="alert"
          ></Alert>
        </div>
      )}
      {!isSearching && emptyResponse && !alertInfo && (
        <div className="search-alert">
          <Alert
            id="no-results-alert"
            className="measure-6"
            message={noResultsMessage}
            title="No cases found"
            type={UswdsAlertStyle.Info}
            show={true}
            slim={true}
            inline={true}
            role="alert"
          ></Alert>
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
            title="search results."
            caption={`Search yielded ${new Intl.NumberFormat('en-US').format(totalCount)} ${totalCount === 1 ? 'result' : 'results'}.`}
          >
            <Header id={id} labels={searchResultsHeaderLabels} />
            <TableBody id={id}>
              {searchResults?.data.map((bCase, idx) => {
                return <Row bCase={bCase} labels={searchResultsHeaderLabels} idx={idx} key={idx} />;
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
