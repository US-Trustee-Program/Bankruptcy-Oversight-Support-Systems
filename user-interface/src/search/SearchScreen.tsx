import { useEffect, useRef, useState } from 'react';
import { useTrackEvent } from '@microsoft/applicationinsights-react-js';
import { CasesSearchPredicate } from '@common/api/search';
import { CaseBasics } from '@common/cams/cases';
import { OfficeDetails } from '@common/cams/courts';
import CaseNumberInput from '@/lib/components/CaseNumberInput';
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
import { InputRef, SelectMultiRef } from '@/lib/type-declarations/input-fields';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { useAppInsights } from '@/lib/hooks/UseApplicationInsights';
import { getOfficeList } from '@/data-verification/dataVerificationHelper';
import { officeSorter } from '@/data-verification/DataVerificationScreen';
import CamsSelectMulti, { MultiSelectOptionList } from '@/lib/components/CamsSelectMulti';
import Button from '@/lib/components/uswds/Button';
import './SearchScreen.scss';
import { isResponseBodySuccess } from '@common/api/response';
import { isPaginated } from '@common/api/pagination';

type AlertProps = {
  show: boolean;
  title: string;
  message: string;
};

type SearchScreenProps = object;

export default function SearchScreen(_props: SearchScreenProps) {
  const [cases, setCases] = useState<CaseBasics[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [previousPage, setPreviousPage] = useState<string | null>(null);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [emptyResponse, setEmptyResponse] = useState<boolean>(false);
  const [alertInfo, setAlertInfo] = useState<AlertProps>({ show: false, title: '', message: '' });
  const [searchPredicate, setSearchPredicate] = useState<CasesSearchPredicate>({
    limit: 25,
    offset: 0,
  });

  const { reactPlugin } = useAppInsights();
  const trackSearchEvent = useTrackEvent(reactPlugin, 'search', {}, true);

  const [_regionsMap, setRegionsMap] = useState<Map<string, string>>(new Map());
  const [officesList, setOfficesList] = useState<Array<OfficeDetails>>([]);

  const caseNumberInputRef = useRef<InputRef>(null);
  const courtSelectionRef = useRef<SelectMultiRef>(null);

  const api = useGenericApi();

  async function getOffices() {
    api
      .get<OfficeDetails[]>(`/offices`, {})
      .then((response) => {
        setOfficesList(response.data.sort(officeSorter));
        setRegionsMap(
          response.data.reduce((regionsMap, office) => {
            if (!regionsMap.has(office.regionId)) {
              regionsMap.set(office.regionId, office.regionName);
            }
            return regionsMap;
          }, new Map()),
        );
      })
      .catch((e) => {
        console.error(e);
      });
  }

  function isValidSearchPredicate(searchPredicate: CasesSearchPredicate): boolean {
    return Object.keys(searchPredicate).reduce((isIt, key) => {
      if (['limit', 'offset'].includes(key)) return isIt;
      return isIt || !!searchPredicate[key as keyof CasesSearchPredicate];
    }, false);
  }

  async function search() {
    if (!isValidSearchPredicate(searchPredicate)) return;

    console.log('searching...', searchPredicate);
    trackSearchEvent(searchPredicate);
    setIsSearching(true);
    disableSearchItems(true);
    api
      .get<CaseBasics[]>(`/cases`, searchPredicate)
      .then((response) => {
        if (isResponseBodySuccess(response)) {
          if (response.data.length) {
            setCases(response.data);
            setEmptyResponse(false);
          } else {
            setCases([]);
            setEmptyResponse(true);
          }
          if (isPaginated(response.meta)) {
            setPreviousPage(response.meta.previous ?? null);
            setNextPage(response.meta.next ?? null);
          }
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
        setIsSearching(false);
        disableSearchItems(false);
      });
  }

  function loadPage(uri: string) {
    console.log('loading page...', uri);
    trackSearchEvent(searchPredicate);
    setIsSearching(true);
    disableSearchItems(true);
    api
      .get<CaseBasics[]>(uri)
      .then((response) => {
        if (isResponseBodySuccess(response)) {
          if (response.data.length) {
            setCases(response.data);
            setEmptyResponse(false);
          } else {
            setCases([]);
            setEmptyResponse(true);
          }
          if (isPaginated(response.meta)) {
            setPreviousPage(response.meta.previous ?? null);
            setNextPage(response.meta.next ?? null);
          }
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
        setIsSearching(false);
        disableSearchItems(false);
      });
  }

  function disableSearchItems(value: boolean) {
    caseNumberInputRef.current?.disable(value);
    courtSelectionRef.current?.disable(value);
  }

  function resetSearch() {
    setAlertInfo({ show: false, title: '', message: '' });
    setCases([]);
  }

  function handleCaseNumberChange(caseNumber?: string): void {
    resetSearch();
    setSearchPredicate({ ...searchPredicate, caseNumber });
  }

  function handleCourtSelection(selection: MultiSelectOptionList) {
    resetSearch();
    setSearchPredicate({
      ...searchPredicate,
      divisionCodes: selection.length
        ? selection.map((kv: Record<string, string>) => kv.value)
        : undefined,
    });
  }

  useEffect(() => {
    getOffices();
  }, []);

  useEffect(() => {
    search();
  }, [searchPredicate]);

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
                  onChange={handleCaseNumberChange}
                  ref={caseNumberInputRef}
                />
              </div>
            </div>
            <div className="case-number-search form-field" data-testid="case-number-search">
              <div className="usa-search usa-search--small">
                <CamsSelectMulti
                  id={'court-selections-search'}
                  className="new-court__select"
                  closeMenuOnSelect={true}
                  label="District (Division)"
                  onChange={handleCourtSelection}
                  options={getOfficeList(officesList)}
                  isSearchable={true}
                  required={false}
                  ref={courtSelectionRef}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="grid-col-8">
          <h2>Results</h2>
          {isSearching ? (
            <LoadingSpinner caption="Searching..." />
          ) : (
            <>
              {!isValidSearchPredicate(searchPredicate) && (
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
              {emptyResponse && isValidSearchPredicate(searchPredicate) && (
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
              {previousPage && (
                <Button
                  onClick={() => {
                    loadPage(previousPage);
                  }}
                >
                  Previous
                </Button>
              )}
              {nextPage && (
                <Button
                  onClick={() => {
                    loadPage(nextPage);
                  }}
                >
                  Next
                </Button>
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
  cases: CaseBasics[];
};

export function SearchCaseTable(props: SearchCaseTableProps) {
  const { id, cases } = props;

  return (
    <Table id={id} className="case-list" scrollable="true" uswdsStyle={['striped']}>
      <TableHeader id={id} className="case-headings">
        <TableHeaderData className="grid-col-3">Case Number (Division)</TableHeaderData>
        <TableHeaderData className="grid-col-6">Case Title</TableHeaderData>
        <TableHeaderData className="grid-col-1">Chapter</TableHeaderData>
        <TableHeaderData className="grid-col-2">Case Filed</TableHeaderData>
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
