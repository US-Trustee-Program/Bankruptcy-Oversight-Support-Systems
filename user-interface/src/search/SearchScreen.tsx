import CaseNumberInput from '@/lib/components/CaseNumberInput';
import './SearchScreen.scss';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import {
  Table,
  TableBody,
  TableHeader,
  TableHeaderData,
  TableRow,
  TableRowData,
} from '@/lib/components/uswds/Table';
import { useGenericApi } from '@/lib/hooks/UseApi';
import { CaseSummary } from '@common/cams/cases';
import { useRef, useState } from 'react';
import { InputRef } from '@/lib/type-declarations/input-fields';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { useTrackEvent } from '@microsoft/applicationinsights-react-js';
import { useAppInsights } from '@/lib/hooks/UseApplicationInsights';

type AlertProps = {
  show: boolean;
  title: string;
  message: string;
};

type SearchScreenProps = object;

export default function SearchScreen(_props: SearchScreenProps) {
  const api = useGenericApi();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [emptyResponse, setEmptyResponse] = useState<boolean>(false);
  const [alertInfo, setAlertInfo] = useState<AlertProps>({ show: false, title: '', message: '' });
  const { reactPlugin } = useAppInsights();
  const trackSearchEvent = useTrackEvent(reactPlugin, 'search', {}, true);

  const caseNumberInputRef = useRef<InputRef>(null);

  function handleCaseNumberFilterUpdate(caseNumber?: string): void {
    setAlertInfo({ show: false, title: '', message: '' });
    if (caseNumber) {
      trackSearchEvent({ caseNumber });
      setLoading(true);
      api
        .post<CaseSummary[]>(`/cases`, { caseNumber })
        .then((response) => {
          if (response.length) {
            setCases(response);
            setEmptyResponse(false);
          } else {
            setCases([]);
            setEmptyResponse(true);
          }
        })
        .catch((_reason) => {
          setCases([]);
          setAlertInfo({
            show: true,
            title: 'Search Results Not Available',
            message:
              'We are unable to retrieve search results at this time. Please try again later. If the problem persists, please submit a feedback request describing the issue.',
          });
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setEmptyResponse(false);
      setCases([]);
    }
  }

  return (
    <div className="search-screen" data-testid="search">
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <h1>Case Search</h1>
        </div>
        <div className="grid-col-1"></div>
      </div>
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-2">
          <h2>Filters</h2>
          <div className={`filter-and-search`} data-testid="filter-and-search-panel">
            <div className="case-number-search form-field" data-testid="case-number-search">
              <div className="usa-search usa-search--small">
                <CaseNumberInput
                  className="search-icon"
                  id="basic-search-field"
                  name="basic-search"
                  label="Case Number"
                  autoComplete="off"
                  onChange={handleCaseNumberFilterUpdate}
                  ref={caseNumberInputRef}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="grid-col-8">
          <h2>Results</h2>
          {loading ? (
            <LoadingSpinner caption="Searching..." />
          ) : (
            <>
              {!caseNumberInputRef.current?.getValue() && (
                <div className="search-alert">
                  <Alert
                    id="default-state-alert"
                    message="Use the Search Filters to find cases."
                    title="Enter search terms"
                    type={UswdsAlertStyle.Info}
                    show={true}
                    slim={true}
                    inline={true}
                  ></Alert>
                </div>
              )}
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
              {emptyResponse && (
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
              {cases.length > 0 && (
                <SearchCaseTable id="search-results" cases={cases}></SearchCaseTable>
              )}
            </>
          )}
        </div>
        <div className="grid-col-1"></div>
      </div>
    </div>
  );
}

type SearchCaseTableProps = {
  id: string;
  cases: CaseSummary[];
};

export function SearchCaseTable(props: SearchCaseTableProps) {
  const { id, cases } = props;

  return (
    <Table id={id} className="case-list" scrollable="true" uswdsStyle={['striped']}>
      <TableHeader id={id} className="case-headings">
        <TableHeaderData>Case Number (Division)</TableHeaderData>
        <TableHeaderData>Case Title</TableHeaderData>
        <TableHeaderData>Chapter</TableHeaderData>
        <TableHeaderData>Case Filed</TableHeaderData>
      </TableHeader>
      <TableBody id={id}>
        {cases.map((bCase, idx) => {
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
  );
}
