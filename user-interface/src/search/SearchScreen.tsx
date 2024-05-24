import { useEffect, useRef, useState } from 'react';
import { CasesSearchPredicate } from '@common/api/search';
import { OfficeDetails } from '@common/cams/courts';
import CaseNumberInput from '@/lib/components/CaseNumberInput';
import { useGenericApi } from '@/lib/hooks/UseApi';
import { InputRef, SelectMultiRef } from '@/lib/type-declarations/input-fields';
import { getOfficeList } from '@/data-verification/dataVerificationHelper';
import { officeSorter } from '@/data-verification/DataVerificationScreen';
import CamsSelectMulti, { MultiSelectOptionList } from '@/lib/components/CamsSelectMulti';
import { isValidSearchPredicate, SearchResults } from '@/search/SearchResults';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import './SearchScreen.scss';

type SearchScreenProps = object;
export const DEFAULT_SEARCH_LIMIT = 25;

export default function SearchScreen(_props: SearchScreenProps) {
  const [searchPredicate, setSearchPredicate] = useState<CasesSearchPredicate>({
    limit: DEFAULT_SEARCH_LIMIT,
    offset: 0,
  });

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

  function _disableSearchItems(value: boolean) {
    caseNumberInputRef.current?.disable(value);
    courtSelectionRef.current?.disable(value);
  }

  function resetSearch() {
    // setAlertInfo({ show: false, title: '', message: '' });
    // clear search form
  }

  function handleCaseNumberChange(caseNumber?: string): void {
    resetSearch();
    const newPredicate = { ...searchPredicate, caseNumber };
    if (!caseNumber) delete newPredicate.caseNumber;
    setSearchPredicate(newPredicate);
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
              updateSearchPredicate={setSearchPredicate}
            />
          )}
        </div>
        <div className="grid-col-1"></div>
      </div>
    </div>
  );
}
