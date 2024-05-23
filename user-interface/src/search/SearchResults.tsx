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
import Button from '@/lib/components/uswds/Button';
import { CasesSearchPredicate } from '@common/api/search';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { useTrackEvent } from '@microsoft/applicationinsights-react-js';
import { useAppInsights } from '@/lib/hooks/UseApplicationInsights';
import { useEffect, useState } from 'react';
import { useGenericApi } from '@/lib/hooks/UseApi';
import { isPaginated, WithPagination } from '@common/api/pagination';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';

export function isValidSearchPredicate(searchPredicate: CasesSearchPredicate): boolean {
  return Object.keys(searchPredicate).reduce((isIt, key) => {
    if (['limit', 'offset'].includes(key)) return isIt;
    return isIt || !!searchPredicate[key as keyof CasesSearchPredicate];
  }, false);
}

type AlertProps = {
  show: boolean;
  title: string;
  message: string;
};

export type SearchResultsProps = {
  id: string;
  searchPredicate: CasesSearchPredicate;
};

export function SearchResults(props: SearchResultsProps) {
  const { id } = props;
  const { reactPlugin } = useAppInsights();
  const trackSearchEvent = useTrackEvent(reactPlugin, 'search', {}, true);

  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [emptyResponse, setEmptyResponse] = useState<boolean>(true);
  const [alertInfo, setAlertInfo] = useState<AlertProps>({ show: false, title: '', message: '' });
  const [searchResults, setSearchResults] = useState<ResponseBodySuccess<CaseBasics[]> | null>(
    null,
  );
  const [searchPredicate, setSearchPredicate] = useState<CasesSearchPredicate>(
    props.searchPredicate,
  );
  const currentPage =
    !!searchPredicate.offset && !!searchPredicate.limit
      ? searchPredicate.offset / searchPredicate.limit + 1
      : 1;
  const meta: WithPagination | undefined = isPaginated(searchResults?.meta)
    ? searchResults?.meta
    : undefined;

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
      show: true,
      title: 'Search Results Not Available',
      message:
        'We are unable to retrieve search results at this time. Please try again later. If the problem persists, please submit a feedback request describing the issue.',
    });
  }

  async function search(uri?: string) {
    if (!isValidSearchPredicate(searchPredicate)) return;

    // Don't hurt me for the l337 code...
    const getArgs: [string, CasesSearchPredicate | undefined] = uri
      ? [uri, undefined]
      : ['/cases', searchPredicate];

    console.log('searching...', searchPredicate);
    trackSearchEvent(searchPredicate);
    setIsSearching(true);
    // TODO: make these a callback? or move them back?
    // disableSearchItems(true);
    api
      .get<CaseBasics[]>(...getArgs)
      .then(handleSearchResults)
      .catch(handleSearchError)
      .finally(() => {
        setIsSearching(false);
        // TODO: see above todo
        // disableSearchItems(false);
      });
  }

  useEffect(() => {
    search();
  }, [searchPredicate]);

  return (
    <div>
      {alertInfo.show && (
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
      {!isSearching && emptyResponse && (
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
                    <TableRowData>{bCase.dateFiled}</TableRowData>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {meta && meta.previous && (
            <Button
              id={'previous-results'}
              onClick={() => {
                setSearchPredicate({
                  ...searchPredicate,
                  offset: (searchPredicate.offset ?? 0) - (searchPredicate.limit ?? 25),
                });
                search(meta.previous!);
              }}
            >
              Previous
            </Button>
          )}
          {currentPage > 1 && (
            <Button
              id={`page-1-results`}
              onClick={() => {
                setSearchPredicate({ ...searchPredicate });
              }}
            >
              1
            </Button>
          )}
          <Button
            id={`page-${currentPage}-results`}
            onClick={() => {
              setSearchPredicate({ ...searchPredicate });
            }}
          >
            {!!searchPredicate.offset && !!searchPredicate.limit
              ? searchPredicate.offset / searchPredicate.limit + 1
              : 1}
          </Button>
          {meta && meta.next && (
            <Button
              id={'next-results'}
              onClick={() => {
                setSearchPredicate({
                  ...searchPredicate,
                  offset: (searchPredicate.offset ?? 0) + (searchPredicate.limit ?? 25),
                });
                search(meta.next!);
              }}
            >
              Next
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
