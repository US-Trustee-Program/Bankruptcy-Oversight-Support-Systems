import './SearchScreen.scss';
import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import {
  CasesSearchPredicate,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_OFFSET,
} from '@common/api/search';
import CaseNumberInput from '@/lib/components/CaseNumberInput';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { ComboBoxRef, InputRef } from '@/lib/type-declarations/input-fields';
import { courtSorter, getDivisionComboOptions } from '@/data-verification/dataVerificationHelper';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import SearchResults, { isValidSearchPredicate } from '@/search-results/SearchResults';
import { SearchResultsHeader } from './SearchResultsHeader';
import { SearchResultsRow } from './SearchResultsRow';
import { useGlobalAlert } from '@/lib/hooks/UseGlobalAlert';
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import { MainContent } from '@/lib/components/cams/MainContent/MainContent';
import Button, { ButtonRef, UswdsButtonStyle } from '@/lib/components/uswds/Button';
import ScreenInfoButton from '@/lib/components/cams/ScreenInfoButton';
import Modal from '@/lib/components/uswds/modal/Modal';
import { ModalRefType } from '@/lib/components/uswds/modal/modal-refs';
import { getCourtDivisionCodes } from '@common/cams/users';
import LocalStorage from '@/lib/utils/local-storage';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import Checkbox from '@/lib/components/uswds/Checkbox';

function isValidFilteredSearch(predicate: CasesSearchPredicate): boolean {
  const { divisionCodes, caseNumber, chapters } = predicate;
  const isValid =
    (!!divisionCodes && divisionCodes.length > 0) ||
    !!caseNumber ||
    (!!chapters && chapters.length > 0);

  return isValid && isValidSearchPredicate(predicate);
}

export default function SearchScreen() {
  const session = LocalStorage.getSession();
  const userCourtDivisionCodes = getCourtDivisionCodes(session!.user);
  const defaultDivisionCodes = userCourtDivisionCodes.length ? userCourtDivisionCodes : undefined;

  const defaultSearchPredicate: CasesSearchPredicate = {
    limit: DEFAULT_SEARCH_LIMIT,
    offset: DEFAULT_SEARCH_OFFSET,
    excludeChildConsolidations: false,
    excludeClosedCases: true,
    divisionCodes: defaultDivisionCodes,
  };
  const [temporarySearchPredicate, setTemporarySearchPredicate] =
    useState<CasesSearchPredicate>(defaultSearchPredicate);
  const [searchPredicate, setSearchPredicate] = useState<CasesSearchPredicate>({});

  const infoModalRef = useRef(null);
  const infoModalId = 'info-modal';

  const [chapterList, setChapterList] = useState<ComboOption[]>([]);
  const [officesList, setOfficesList] = useState<ComboOption[]>([]);
  const [activeElement, setActiveElement] = useState<Element | null>(null);

  const caseNumberInputRef = useRef<InputRef>(null);
  const courtSelectionRef = useRef<ComboBoxRef>(null);
  const chapterSelectionRef = useRef<ComboBoxRef>(null);
  const submitButtonRef = useRef<ButtonRef>(null);

  const api = useApi2();
  const globalAlert = useGlobalAlert();

  function getChapters() {
    const chapterArray: ComboOption[] = [];

    for (const item of ['7', '9', '11', '12', '13', '15']) {
      chapterArray.push({ label: item, value: item });
    }

    setChapterList(chapterArray);
  }

  function getCourts() {
    api
      .getCourts()
      .then((response) => {
        const newOfficesList = response.data.sort(courtSorter);
        const officeComboOptions = getDivisionComboOptions(newOfficesList);
        const filteredDivisionCodes = getDivisionComboOptions(
          newOfficesList.filter((office) =>
            defaultDivisionCodes?.includes(office.courtDivisionCode),
          ),
        );
        if (filteredDivisionCodes.length) {
          filteredDivisionCodes[filteredDivisionCodes.length - 1].divider = true;
          filteredDivisionCodes.forEach((option: ComboOption) => {
            option.isAriaDefault = true;
          });
        }
        const filteredOfficeComboOptions = officeComboOptions.filter((officeComboOption) => {
          return !defaultDivisionCodes?.includes(officeComboOption.value);
        });
        const finalOfficeComboOptions = [...filteredDivisionCodes, ...filteredOfficeComboOptions];
        setOfficesList(finalOfficeComboOptions);
        courtSelectionRef.current?.setSelections(filteredDivisionCodes);
      })
      .catch(() => {
        globalAlert?.error('Cannot load office list');
      });
  }

  function disableSearchForm(value: boolean) {
    caseNumberInputRef.current?.disable(value);
    courtSelectionRef.current?.disable(value);
    chapterSelectionRef.current?.disable(value);
  }

  function setStartSearching() {
    disableSearchForm(true);
  }

  function setEndSearching() {
    disableSearchForm(false);
  }

  function handleFilterFormElementFocus(ev: React.FocusEvent<HTMLElement>) {
    if (activeElement !== ev.target) {
      setActiveElement(ev.target);
    }
  }

  function handleCaseNumberChange(caseNumber?: string): void {
    if (temporarySearchPredicate.caseNumber != caseNumber) {
      const newPredicate = { ...temporarySearchPredicate, caseNumber };
      if (!caseNumber) {
        delete newPredicate.caseNumber;
      }
      setTemporarySearchPredicate(newPredicate);
    }
  }

  function handleCourtSelection(selection: ComboOption[]) {
    const newPredicate = {
      ...temporarySearchPredicate,
    };
    delete newPredicate.divisionCodes;
    if (selection.length) {
      newPredicate.divisionCodes = selection.map((kv: ComboOption) => kv.value);
    }
    setTemporarySearchPredicate(newPredicate);
  }

  function handleChapterSelection(selections: ComboOption[]) {
    const newPredicate = {
      ...temporarySearchPredicate,
    };
    delete newPredicate.chapters;
    if (selections.length) {
      newPredicate.chapters = selections.map((option: ComboOption) => option.value);
    }
    setTemporarySearchPredicate(newPredicate);
  }

  function handleIncludeClosedCheckbox(ev: ChangeEvent<HTMLInputElement>) {
    setTemporarySearchPredicate((previous) => {
      return {
        ...previous,
        excludeClosedCases: !ev.target.checked,
      };
    });
  }

  function performSearch() {
    setSearchPredicate(temporarySearchPredicate);
  }

  const infoModalActionButtonGroup = {
    modalId: infoModalId,
    modalRef: infoModalRef as React.RefObject<ModalRefType>,
    cancelButton: {
      label: 'Return',
      uswdsStyle: UswdsButtonStyle.Default,
    },
  };

  useEffect(() => {
    getCourts();
    getChapters();
  }, []);

  return (
    <MainContent className="search-screen" data-testid="search">
      <DocumentTitle name="Case Search" />
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-1"></div>
        <div className="grid-col-10">
          <h1>Case Search</h1>
          <ScreenInfoButton infoModalRef={infoModalRef} modalId={infoModalId} />
        </div>
        <div className="grid-col-1"></div>
      </div>
      <div className="grid-row grid-gap-lg search-pane">
        <div className="grid-col-1"></div>
        <div className="grid-col-2">
          <h2>Search By</h2>
          <div className="filter-and-search" data-testid="filter-and-search-panel">
            <div className="case-number-search form-field" data-testid="case-number-search">
              <div className="usa-search usa-search--small">
                <CaseNumberInput
                  className="search-icon"
                  id="basic-search-field"
                  name="basic-search"
                  label="Case Number"
                  autoComplete="off"
                  onChange={handleCaseNumberChange}
                  onFocus={handleFilterFormElementFocus}
                  allowEnterKey={true}
                  allowPartialCaseNumber={false}
                  aria-label="Find case by Case Number."
                  ref={caseNumberInputRef}
                />
              </div>
            </div>
            <div className="case-district-search form-field" data-testid="case-district-search">
              <div className="usa-search usa-search--small">
                <ComboBox
                  id={'court-selections-search'}
                  className="new-court__select"
                  label="District (Division)"
                  aria-live="off"
                  onUpdateSelection={handleCourtSelection}
                  onFocus={handleFilterFormElementFocus}
                  options={officesList}
                  required={false}
                  multiSelect={true}
                  wrapPills={true}
                  ref={courtSelectionRef}
                  singularLabel="division"
                  pluralLabel="divisions"
                  overflowStrategy="ellipsis"
                />
              </div>
            </div>
            <div className="case-chapter-search form-field" data-testid="case-chapter-search">
              <div className="usa-search usa-search--small">
                <ComboBox
                  id={'case-chapter-search'}
                  className="case-chapter__select"
                  label="Chapter"
                  aria-live="off"
                  onUpdateSelection={handleChapterSelection}
                  onFocus={handleFilterFormElementFocus}
                  options={chapterList}
                  required={false}
                  multiSelect={true}
                  ref={chapterSelectionRef}
                  singularLabel="chapter"
                  pluralLabel="chapters"
                />
              </div>
            </div>
            <div className="case-include-closed form-field">
              <div className="usa-search usa-search--small">
                <Checkbox
                  id="include-closed"
                  name="includeClosedCases"
                  value="true"
                  checked={!temporarySearchPredicate.excludeClosedCases}
                  label="Include Closed Cases"
                  onChange={handleIncludeClosedCheckbox}
                />
              </div>
            </div>
            <div className="search-form-submit form-field">
              <Button
                id="search-submit"
                className="search-submit-button"
                uswdsStyle={UswdsButtonStyle.Default}
                ref={submitButtonRef}
                onClick={performSearch}
                disabled={!isValidFilteredSearch(temporarySearchPredicate)}
              >
                Search
              </Button>
            </div>
          </div>
        </div>
        <div className="grid-col-8" role="status" aria-live="polite">
          <h2>Results</h2>
          {!isValidFilteredSearch(searchPredicate) && (
            <div className="search-alert">
              <Alert
                id="default-state-alert"
                message="Use the Search Filters to find cases."
                title="Enter search terms"
                type={UswdsAlertStyle.Info}
                show={true}
                slim={true}
                inline={true}
                role="alert"
              ></Alert>
            </div>
          )}
          {isValidFilteredSearch(searchPredicate) && (
            <SearchResults
              id="search-results"
              searchPredicate={searchPredicate}
              onStartSearching={setStartSearching}
              onEndSearching={setEndSearching}
              header={SearchResultsHeader}
              row={SearchResultsRow}
            />
          )}
        </div>
        <div className="grid-col-1"></div>
      </div>
      <Modal
        ref={infoModalRef}
        modalId={infoModalId}
        className="search-info-modal"
        heading="Case Search - Using This Page"
        content={
          <>
            Case Search allows you to search for any case in the system, across regions and offices.
            Use the filters to find the case you’re interested in. You can view details about a case
            in the search results by clicking on its case number.
          </>
        }
        actionButtonGroup={infoModalActionButtonGroup}
      ></Modal>
    </MainContent>
  );
}
