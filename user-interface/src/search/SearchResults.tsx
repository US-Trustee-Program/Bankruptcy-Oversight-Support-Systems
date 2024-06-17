import { isResponseBodySuccess, ResponseBodySuccess } from '@common/api/response';
import { CaseBasics } from '@common/cams/cases';
import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderData,
  TableRow,
  TableRowData,
} from '@/lib/components/uswds/Table';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { CasesSearchPredicate } from '@common/api/search';
import Alert, { AlertDetails, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { useTrackEvent } from '@microsoft/applicationinsights-react-js';
import { useAppInsights } from '@/lib/hooks/UseApplicationInsights';
import { useContext, useEffect, useState } from 'react';
import { useGenericApi } from '@/lib/hooks/UseApi';
import { isPaginated, WithPagination } from '@common/api/pagination';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { Pagination } from '@/lib/components/uswds/Pagination';
import { formatDate } from '@/lib/utils/datetime';
import { SessionContext } from '@/login/Session';

export function isValidSearchPredicate(searchPredicate: CasesSearchPredicate): boolean {
  return Object.keys(searchPredicate).reduce((isIt, key) => {
    if (['limit', 'offset'].includes(key)) return isIt;
    return isIt || !!searchPredicate[key as keyof CasesSearchPredicate];
  }, false);
}

export type SearchResultsProps = {
  id: string;
  searchPredicate: CasesSearchPredicate;
  onStartSearching: () => void;
  onEndSearching: () => void;
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

  const session = useContext(SessionContext);
  const api = useGenericApi(session);

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
    onStartSearching();
    api
      .get<CaseBasics[]>('/cases', searchPredicate)
      .then(handleSearchResults)
      .catch(handleSearchError)
      .finally(() => {
        setIsSearching(false);
        onEndSearching();
      });
  }

  function handlePagination(predicate: CasesSearchPredicate) {
    setSearchPredicate(predicate);
  }

  useEffect(() => {
    setSearchPredicate(props.searchPredicate);
  }, [props.searchPredicate]);

  useEffect(() => {
    search();
  }, [searchPredicate]);

  return (
    <div>
      {alertInfo && (
        <div className="search-alert">
          <Alert
            id="search-error-alert"
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
            message="Modify your search criteria to include more cases."
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
            <TableHeader id={id} className="case-headings">
              <TableHeaderData className="grid-col-3">Case Number (Division)</TableHeaderData>
              <TableHeaderData className="grid-col-6">Case Title</TableHeaderData>
              <TableHeaderData className="grid-col-1">Chapter</TableHeaderData>
              <TableHeaderData className="grid-col-2">Case Filed</TableHeaderData>
            </TableHeader>
            <TableBody id={id}>
              {searchResults?.data.map((bCase, idx) => {
                return (
                  <TableRow key={idx}>
                    <TableRowData dataSortValue={bCase.caseId}>
                      <span className="no-wrap">
                        <CaseNumber caseId={bCase.caseId} /> ({bCase.courtDivisionName})
                      </span>
                    </TableRowData>
                    <TableRowData>{bCase.caseTitle}</TableRowData>
                    <TableRowData>{bCase.chapter}</TableRowData>
                    <TableRowData>{formatDate(bCase.dateFiled)}</TableRowData>
                  </TableRow>
                );
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
