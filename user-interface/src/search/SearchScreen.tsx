import { useEffect, useRef, useState } from 'react';
import {
  CasesSearchPredicate,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_OFFSET,
} from '@common/api/search';
import { OfficeDetails } from '@common/cams/courts';
import CaseNumberInput from '@/lib/components/CaseNumberInput';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { InputRef, SelectMultiRef } from '@/lib/type-declarations/input-fields';
import { getOfficeList } from '@/data-verification/dataVerificationHelper';
import { officeSorter } from '@/data-verification/DataVerificationScreen';
import CamsSelectMulti, { MultiSelectOptionList } from '@/lib/components/CamsSelectMulti';
import { isValidSearchPredicate, SearchResults } from '@/search/SearchResults';
import Alert, { AlertProps, AlertRefType, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import './SearchScreen.scss';

const DEFAULT_ALERT = {
  show: false,
  title: '',
  message: '',
  type: UswdsAlertStyle.Error,
  timeout: 5,
};

export default function SearchScreen() {
  const [searchPredicate, setSearchPredicate] = useState<CasesSearchPredicate>({
    limit: DEFAULT_SEARCH_LIMIT,
    offset: DEFAULT_SEARCH_OFFSET,
  });

  const [officesList, setOfficesList] = useState<Array<OfficeDetails>>([]);
  const [errorAlert, setErrorAlert] = useState<AlertProps>(DEFAULT_ALERT);

  const caseNumberInputRef = useRef<InputRef>(null);
  const courtSelectionRef = useRef<SelectMultiRef>(null);
  const errorAlertRef = useRef<AlertRefType>(null);

  const api = useApi2();

  async function getOffices() {
    api
      .getOffices()
      .then((response) => {
        setOfficesList(response.data.sort(officeSorter));
      })
      .catch(() => {
        setErrorAlert({
          ...DEFAULT_ALERT,
          title: 'Error',
          message: 'Cannot load office list',
          show: true,
        });
        errorAlertRef.current?.show(false);
      });
  }

  function disableSearchForm(value: boolean) {
    caseNumberInputRef.current?.disable(value);
    courtSelectionRef.current?.disable(value);
  }

  function handleCaseNumberChange(caseNumber?: string): void {
    const newPredicate = { ...searchPredicate, caseNumber };
    if (!caseNumber) delete newPredicate.caseNumber;
    setSearchPredicate(newPredicate);
  }

  function handleCourtSelection(selection: MultiSelectOptionList) {
    const newPredicate = {
      ...searchPredicate,
    };
    delete newPredicate.divisionCodes;
    if (selection.length) {
      newPredicate.divisionCodes = selection.map((kv: Record<string, string>) => kv.value);
    }
    setSearchPredicate(newPredicate);
  }

  useEffect(() => {
    getOffices();
  }, []);

  useEffect(() => {}, [searchPredicate]);

  return (
    <div className="search-screen" data-testid="search">
      <Alert ref={errorAlertRef} inline={false} {...errorAlert}></Alert>
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
          {isValidSearchPredicate(searchPredicate) && (
            <SearchResults
              id="search-results"
              searchPredicate={searchPredicate}
              onStartSearching={() => {
                disableSearchForm(true);
              }}
              onEndSearching={() => {
                disableSearchForm(false);
              }}
            />
          )}
        </div>
        <div className="grid-col-1"></div>
      </div>
    </div>
  );
}
