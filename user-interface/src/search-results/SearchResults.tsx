import './SearchResults.scss';
import { useEffect, useState } from 'react';
import { useTrackEvent } from '@microsoft/applicationinsights-react-js';
import { isResponseBodySuccess, ResponseBodySuccess } from '@common/api/response';
import { CaseBasics } from '@common/cams/cases';
import { Table, TableBody, TableRowProps } from '@/lib/components/uswds/Table';
import { CasesSearchPredicate } from '@common/api/search';
import Alert, { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { useAppInsights } from '@/lib/hooks/UseApplicationInsights';
import { useGenericApi } from '@/lib/hooks/UseApi';
import { isPaginated, WithPagination } from '@common/api/pagination';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { Pagination } from '@/lib/components/uswds/Pagination';
import { deepEqual } from '@/lib/utils/objectEquality';

export function isValidSearchPredicate(searchPredicate: CasesSearchPredicate): boolean {
  return Object.keys(searchPredicate).reduce((isIt, key) => {
    if (['limit', 'offset'].includes(key)) return isIt;
    return isIt || !!searchPredicate[key as keyof CasesSearchPredicate];
  }, false);
}

function sortByDateFiled(a: CaseBasics, b: CaseBasics): number {
  if (a.dateFiled < b.dateFiled) {
    return 1;
  } else if (a.dateFiled > b.dateFiled) {
    return -1;
  } else {
    return 0;
  }
}

function sortByCaseId(a: CaseBasics, b: CaseBasics): number {
  if (a.caseId < b.caseId) {
    return 1;
  } else if (a.caseId > b.caseId) {
    return -1;
  } else {
    return 0;
  }
}

export function sortCaseList(a: CaseBasics, b: CaseBasics) {
  // Date filed take priority over case Id.
  const byDateFiled = sortByDateFiled(a, b);
  return byDateFiled === 0 ? sortByCaseId(a, b) : byDateFiled;
}

export type SearchResultsHeaderProps = {
  id: string;
};

export type SearchResultsRowProps = TableRowProps & {
  idx: number;
  bCase: CaseBasics;
  // TODO: Flesh out the options typing.
  options?: object;
};

export type SearchResultsProps = {
  id: string;
  searchPredicate: CasesSearchPredicate;
  onStartSearching?: () => void;
  onEndSearching?: () => void;
  noResultsMessage?: string;
  header: (props: SearchResultsHeaderProps) => JSX.Element;
  row: (props: SearchResultsRowProps) => JSX.Element;
};

export function SearchResults(props: SearchResultsProps) {
  const { id, onStartSearching, onEndSearching } = props;
  const { reactPlugin } = useAppInsights();
  const trackSearchEvent = useTrackEvent(reactPlugin, 'search', {}, true);
  const [searchPredicate, setSearchPredicate] = useState<CasesSearchPredicate>(
    props.searchPredicate,
  );
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [emptyResponse, setEmptyResponse] = useState<boolean>(true);
  const [alertInfo, setAlertInfo] = useState<AlertDetails | null>(null);
  const [searchResults, setSearchResults] = useState<ResponseBodySuccess<CaseBasics[]> | null>(
    null,
  );

  const pagination: WithPagination | undefined = isPaginated(searchResults?.meta)
    ? searchResults?.meta
    : undefined;

  const noResultsMessage =
    props.noResultsMessage ?? 'Modify your search criteria to include more cases.';

  const api = useGenericApi();

  function handleSearchResults(response: ResponseBodySuccess<CaseBasics[]>) {
    if (isResponseBodySuccess(response)) {
      setSearchResults(response);
      setEmptyResponse(response.data.length === 0);
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

  async function search() {
    if (!isValidSearchPredicate(searchPredicate)) return;
    resetAlert();

    trackSearchEvent(searchPredicate);
    setIsSearching(true);
    if (onStartSearching) onStartSearching();
    api
      .post<CaseBasics[]>('/cases', searchPredicate)
      .then(handleSearchResults)
      .catch(handleSearchError)
      .finally(() => {
        setIsSearching(false);
        if (onEndSearching) onEndSearching();
      });
  }

  function handlePagination(predicate: CasesSearchPredicate) {
    setSearchPredicate(predicate);
  }

  useEffect(() => {
    if (!deepEqual(props.searchPredicate, searchPredicate)) {
      setSearchPredicate(props.searchPredicate);
    }
  }, [props.searchPredicate]);

  useEffect(() => {
    search();
  }, [searchPredicate]);

  const Header = props.header;
  const Row = props.row;

  return (
    <div className="search-results">
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
          ></Alert>
        </div>
      )}
      {isSearching && <LoadingSpinner caption="Searching..." />}
      {!isSearching && !emptyResponse && (
        <div>
          <Table id={id} className="case-list" scrollable="true" uswdsStyle={['striped']}>
            <Header id={id} />
            <TableBody id={id}>
              {searchResults?.data.map((bCase, idx) => {
                return <Row bCase={bCase} idx={idx} key={idx} />;
              })}
            </TableBody>
          </Table>
          {pagination && (
            <Pagination<CasesSearchPredicate>
              paginationMeta={pagination}
              searchPredicate={searchPredicate}
              retrievePage={handlePagination}
            />
          )}
        </div>
      )}
    </div>
  );
}
