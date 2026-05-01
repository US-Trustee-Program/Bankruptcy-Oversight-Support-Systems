import { useEffect, useState, type JSX } from 'react';
import { useTrackEvent } from '@microsoft/applicationinsights-react-js';
import { DxtrCase, SyncedCase } from '@common/cams/cases';
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
  showOpenClosedColumn?: boolean;
};

export type SearchResultsRowProps = TableRowProps & {
  idx: number;
  bCase: DxtrCase;
  labels: string[];
  phoneticSearchEnabled?: boolean;
  showDebtorNameColumn?: boolean;
  showOpenClosedColumn?: boolean;
};

export type SearchResultsProps = JSX.IntrinsicElements['table'] & {
  id: string;
  searchPredicate: CasesSearchPredicate;
  phoneticSearchEnabled?: boolean;
  showDebtorNameColumn?: boolean;
  showOpenClosedColumn?: boolean;
  onStartSearching?: () => void;
  onEndSearching?: () => void;
  onIncludeClosedCases?: () => void;
  noResultsMessage?: string;
  noResultsAlertProps?: AlertProps;
  header: (props: SearchResultsHeaderProps) => JSX.Element;
  row: (props: SearchResultsRowProps) => JSX.Element;
};

type ClosedCasesHintMessageProps = {
  closedCasesCount?: number;
  variant: 'generic' | 'count';
  onIncludeClosedCases?: () => void;
};

function ClosedCasesHintMessage({
  closedCasesCount = 0,
  variant,
  onIncludeClosedCases,
}: ClosedCasesHintMessageProps) {
  const text =
    variant === 'count'
      ? `${closedCasesCount} closed ${closedCasesCount === 1 ? 'case' : 'cases'} match your search filters.`
      : 'There may be closed cases that match your search filters.';

  return (
    <p className="usa-alert__text">
      {text}{' '}
      <button
        type="button"
        className="usa-button usa-button--unstyled"
        onClick={() => onIncludeClosedCases?.()}
      >
        Include Closed Cases
      </button>
    </p>
  );
}

function SearchResults(props: SearchResultsProps) {
  const {
    id,
    searchPredicate: searchPredicateProp,
    phoneticSearchEnabled = false,
    showDebtorNameColumn = false,
    showOpenClosedColumn = false,
    onStartSearching,
    onEndSearching,
    onIncludeClosedCases,
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

  const searchResultsHeaderLabels = (() => {
    const labels = ['Case Number (Division)', 'Case Title'];
    if (showDebtorNameColumn) labels.push('Debtor Name');
    labels.push('Chapter', 'Case Filed');
    if (showOpenClosedColumn) labels.push('Open/Closed');
    return labels;
  })();

  const showClosedCasesHint =
    searchPredicate.excludeClosedCases === true && !searchPredicate.caseNumber;

  const closedCasesCount = searchResults?.pagination?.closedCasesCount ?? 0;
  const showCaseNumberClosedHint =
    !!searchPredicate.caseNumber &&
    searchPredicate.excludeClosedCases === true &&
    closedCasesCount > 0;

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

  const totalCount = searchResults?.pagination?.totalCount ?? searchResults?.data?.length ?? 0;
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
          ></Alert>
        </div>
      )}
      {!isSearching && emptyResponse && !alertInfo && showCaseNumberClosedHint && (
        <div className="search-alert">
          <Alert
            id="no-results-alert"
            className="measure-6"
            title="No Open cases found"
            type={UswdsAlertStyle.Info}
            show={true}
            inline={true}
            role="alert"
          >
            <ClosedCasesHintMessage
              variant="count"
              closedCasesCount={closedCasesCount}
              onIncludeClosedCases={onIncludeClosedCases}
            />
          </Alert>
        </div>
      )}
      {!isSearching && emptyResponse && !alertInfo && showClosedCasesHint && (
        <div className="search-alert">
          <Alert
            id="no-results-alert"
            className="measure-6"
            title="No Open cases found"
            type={UswdsAlertStyle.Info}
            show={true}
            inline={true}
            role="alert"
          >
            <ClosedCasesHintMessage variant="generic" onIncludeClosedCases={onIncludeClosedCases} />
          </Alert>
        </div>
      )}
      {!isSearching &&
        emptyResponse &&
        !alertInfo &&
        !showClosedCasesHint &&
        !showCaseNumberClosedHint &&
        !noResultsAlertProps && (
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
      {!isSearching && !emptyResponse && showCaseNumberClosedHint && (
        <div className="search-alert">
          <Alert
            id="closed-cases-hint-alert"
            className="measure-6"
            type={UswdsAlertStyle.Info}
            show={true}
            inline={true}
            role="status"
            slim={true}
          >
            <ClosedCasesHintMessage
              variant="count"
              closedCasesCount={closedCasesCount}
              onIncludeClosedCases={onIncludeClosedCases}
            />
          </Alert>
        </div>
      )}
      {!isSearching && !emptyResponse && showClosedCasesHint && (
        <div className="search-alert">
          <Alert
            id="closed-cases-hint-alert"
            className="measure-6"
            type={UswdsAlertStyle.Info}
            show={true}
            inline={true}
            role="status"
            slim={true}
          >
            <ClosedCasesHintMessage variant="generic" onIncludeClosedCases={onIncludeClosedCases} />
          </Alert>
        </div>
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
              showOpenClosedColumn={showOpenClosedColumn}
            />
            <TableBody id={id}>
              {searchResults?.data.map((bCase, idx) => {
                return (
                  <Row
                    bCase={bCase}
                    labels={searchResultsHeaderLabels}
                    phoneticSearchEnabled={phoneticSearchEnabled}
                    showDebtorNameColumn={showDebtorNameColumn}
                    showOpenClosedColumn={showOpenClosedColumn}
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
