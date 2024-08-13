import './SearchResults.scss';
import { useEffect, useRef, useState } from 'react';
import { useTrackEvent } from '@microsoft/applicationinsights-react-js';
import { isResponseBodySuccess, ResponseBodySuccess } from '@common/api/response';
import { CaseBasics } from '@common/cams/cases';
import { Table, TableBody, TableHeader, TableHeaderData } from '@/lib/components/uswds/Table';
import { CasesSearchPredicate } from '@common/api/search';
import Alert, { AlertDetails, AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { useAppInsights } from '@/lib/hooks/UseApplicationInsights';
import { useGenericApi } from '@/lib/hooks/UseApi';
import { isPaginated, WithPagination } from '@common/api/pagination';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { Pagination } from '@/lib/components/uswds/Pagination';
import { deepEqual } from '@/lib/utils/objectEquality';
import { AttorneyUser } from '@common/cams/users';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import AttorneysApi from '@/lib/models/attorneys-api';
import AssignAttorneyModal, {
  AssignAttorneyModalRef,
  CallBackProps,
} from '@/my-cases/assign-attorney/AssignAttorneyModal';
import { SearchResultsRow } from './SearchResultsRow';

export function isValidSearchPredicate(searchPredicate: CasesSearchPredicate): boolean {
  return Object.keys(searchPredicate).reduce((isIt, key) => {
    if (['limit', 'offset'].includes(key)) return isIt;
    return isIt || !!searchPredicate[key as keyof CasesSearchPredicate];
  }, false);
}

export type SearchResultsProps = {
  id: string;
  searchPredicate: CasesSearchPredicate;
  onStartSearching?: () => void;
  onEndSearching?: () => void;
  noResultsMessage?: string;
};

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

export function SearchResults(props: SearchResultsProps) {
  const TABLE_TRANSFER_TIMEOUT = 10;

  const { id, onStartSearching, onEndSearching } = props;
  const { reactPlugin } = useAppInsights();
  const trackSearchEvent = useTrackEvent(reactPlugin, 'search', {}, true);
  const [caseList, setCaseList] = useState<CaseBasics[]>([]);
  const [attorneyList, setAttorneyList] = useState<AttorneyUser[]>([]);
  const [searchPredicate, setSearchPredicate] = useState<CasesSearchPredicate>(
    props.searchPredicate,
  );
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [emptyResponse, setEmptyResponse] = useState<boolean>(true);
  const [alertInfo, setAlertInfo] = useState<AlertDetails | null>(null);
  const [searchResults, setSearchResults] = useState<ResponseBodySuccess<CaseBasics[]> | null>(
    null,
  );

  const [assignmentAlert, setAssignmentAlert] = useState<{
    message: string;
    type: UswdsAlertStyle;
    timeOut: number;
  }>({ message: '', type: UswdsAlertStyle.Success, timeOut: 8 });

  const assignmentAlertRef = useRef<AlertRefType>(null);
  const assignmentModalRef = useRef<AssignAttorneyModalRef>(null);
  const assignmentModalId = 'assign-attorney-modal';

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

  function updateCase({
    bCase,
    selectedAttorneyList,
    previouslySelectedList,
    status,
    apiResult,
  }: CallBackProps) {
    if (status === 'error') {
      setAssignmentAlert({
        message: (apiResult as Error).message,
        type: UswdsAlertStyle.Error,
        timeOut: 8,
      });
      assignmentAlertRef.current?.show();
    } else if (bCase) {
      const messageArr = [];
      const addedAssignments = selectedAttorneyList.filter(
        (el) => !previouslySelectedList.includes(el),
      );
      const removedAssignments = previouslySelectedList.filter(
        (el) => !selectedAttorneyList.includes(el),
      );

      if (addedAssignments.length > 0) {
        messageArr.push(
          `${addedAssignments.map((attorney) => attorney.name).join(', ')} assigned to`,
        );
      }
      if (removedAssignments.length > 0) {
        messageArr.push(
          `${removedAssignments.map((attorney) => attorney.name).join(', ')} unassigned from`,
        );
      }

      bCase.assignments = selectedAttorneyList;

      const updatedCaseList = caseList.filter((aCase) => {
        return aCase.caseId !== bCase.caseId;
      });
      updatedCaseList.push(bCase);
      updatedCaseList.sort(sortCaseList);
      setCaseList(updatedCaseList);

      const alertMessage =
        messageArr.join(' case and ') + ` case ${getCaseNumber(bCase.caseId)} ${bCase.caseTitle}.`;

      setAssignmentAlert({ message: alertMessage, type: UswdsAlertStyle.Success, timeOut: 8 });
      assignmentAlertRef.current?.show();

      //TODO: Revisit this TABLE_TRANSFER_TIMEOUT
      setTimeout(() => {}, TABLE_TRANSFER_TIMEOUT * 1000);

      assignmentModalRef.current?.hide();
    }
  }

  // TODO: Migrate get attorneys to api2
  const fetchAttorneys = () => {
    AttorneysApi.getAttorneys()
      .then((attorneys) => {
        setAttorneyList(attorneys);
      })
      .catch((reason) => {
        setAssignmentAlert({
          message: reason.message,
          type: UswdsAlertStyle.Error,
          timeOut: 0,
        });
        assignmentAlertRef.current?.show();
      });
  };

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

  useEffect(() => {
    fetchAttorneys();
  }, []);

  return (
    <div className="search-results">
      <Alert
        message={assignmentAlert.message}
        type={assignmentAlert.type}
        role="status"
        ref={assignmentAlertRef}
        timeout={assignmentAlert.timeOut}
      />
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
            <TableHeader id={id} className="case-headings">
              <TableHeaderData className="grid-col-3">Case Number (Division)</TableHeaderData>
              <TableHeaderData className="grid-col-3">Case Title</TableHeaderData>
              <TableHeaderData className="grid-col-1">Chapter</TableHeaderData>
              <TableHeaderData className="grid-col-1">Case Filed</TableHeaderData>
              <TableHeaderData className="grid-col-4" scope="col">
                Assigned Staff
              </TableHeaderData>
            </TableHeader>
            <TableBody id={id}>
              {searchResults?.data.map((bCase, idx) => {
                return (
                  <SearchResultsRow
                    bCase={bCase}
                    idx={idx}
                    modalId={assignmentModalId}
                    modalRef={assignmentModalRef}
                    key={idx}
                  ></SearchResultsRow>
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
      <AssignAttorneyModal
        ref={assignmentModalRef}
        attorneyList={attorneyList}
        modalId={`${assignmentModalId}`}
        callBack={updateCase}
      ></AssignAttorneyModal>
    </div>
  );
}
