import './SearchScreen.scss';
import React, { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CasesSearchPredicate,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_OFFSET,
} from '@common/api/search';
import CaseNumberInput from '@/lib/components/CaseNumberInput';
import Input from '@/lib/components/uswds/Input';
import Api2 from '@/lib/models/api2';
import { ComboBoxRef, InputRef } from '@/lib/type-declarations/input-fields';
import { getDivisionComboOptions } from '@/data-verification/dataVerificationHelper';
import { sortByCourtLocation } from '@/lib/utils/court-utils';
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
import { SEARCH_SCREEN_SPEC, SearchScreenFormData } from './searchScreen.types';
import { validateObject, ValidatorReasonMap } from '@common/cams/validation';
import useDebounce from '@/lib/hooks/UseDebounce';
import useFeatureFlags, {
  PHONETIC_SEARCH_ENABLED,
  SHOW_DEBTOR_NAME_COLUMN,
} from '@/lib/hooks/UseFeatureFlags';

/**
 * Centralized validation function that validates form data and returns both field-level
 * and form-level errors in a consistent way.
 *
 * This function handles both spec-based validation and special cases like raw input validation
 * for case numbers (where user has typed but no valid case number was parsed).
 */
export function validateFormData(formData: SearchScreenFormData): {
  isValid: boolean;
  fieldErrors: ValidatorReasonMap;
  formValidationError: string | null;
} {
  const results = validateObject(SEARCH_SCREEN_SPEC, formData);
  const fieldErrors: ValidatorReasonMap = { ...results.reasonMap };

  const formValidationError = results.reasonMap?.$?.reasons?.[0] || null;

  // Form is valid only if spec validation passes AND there are no field errors
  const isValid = !!results.valid && Object.keys(fieldErrors).length === 0;

  return {
    isValid,
    fieldErrors,
    formValidationError,
  };
}

export default function SearchScreen() {
  const featureFlags = useFeatureFlags();
  const phoneticSearchEnabled = featureFlags[PHONETIC_SEARCH_ENABLED] === true;
  const showDebtorNameColumn = featureFlags[SHOW_DEBTOR_NAME_COLUMN] === true;

  const session = LocalStorage.getSession();
  const userCourtDivisionCodes = getCourtDivisionCodes(session!.user);
  const defaultDivisionCodes = userCourtDivisionCodes.length ? userCourtDivisionCodes : undefined;

  const defaultSearchPredicate: CasesSearchPredicate = {
    limit: DEFAULT_SEARCH_LIMIT,
    offset: DEFAULT_SEARCH_OFFSET,
    excludeMemberConsolidations: false,
    excludeClosedCases: true,
    divisionCodes: defaultDivisionCodes,
  };
  const [temporarySearchPredicate, setTemporarySearchPredicate] =
    useState<CasesSearchPredicate>(defaultSearchPredicate);
  const [searchPredicate, setSearchPredicate] = useState<CasesSearchPredicate>({});
  const [showCaseNumberError, setShowCaseNumberError] = useState<boolean>(false);
  const [showDebtorNameError, setShowDebtorNameError] = useState<boolean>(false);
  const [hasAttemptedSearch, setHasAttemptedSearch] = useState<boolean>(false);

  const infoModalRef = useRef(null);
  const infoModalId = 'info-modal';

  const [chapterList, setChapterList] = useState<ComboOption[]>([]);
  const [officesList, setOfficesList] = useState<ComboOption[]>([]);
  const [activeElement, setActiveElement] = useState<Element | null>(null);

  const caseNumberInputRef = useRef<InputRef>(null);
  const debtorNameInputRef = useRef<InputRef>(null);
  const courtSelectionRef = useRef<ComboBoxRef>(null);
  const chapterSelectionRef = useRef<ComboBoxRef>(null);
  const submitButtonRef = useRef<ButtonRef>(null);

  const globalAlert = useGlobalAlert();
  const debounce = useDebounce();

  const mapToFormData = (predicate: CasesSearchPredicate): SearchScreenFormData => {
    return {
      caseNumber: predicate.caseNumber,
      debtorName: predicate.debtorName,
      divisionCodes: predicate.divisionCodes,
      chapters: predicate.chapters,
      excludeClosedCases: predicate.excludeClosedCases,
    };
  };

  const currentValidation = useMemo(() => {
    const formData = mapToFormData(temporarySearchPredicate);
    return validateFormData(formData);
  }, [temporarySearchPredicate]);

  const fieldErrors: ValidatorReasonMap = useMemo(() => {
    const errors: ValidatorReasonMap = {};
    if (showCaseNumberError && currentValidation.fieldErrors.caseNumber) {
      errors.caseNumber = currentValidation.fieldErrors.caseNumber;
    }
    if (showDebtorNameError && currentValidation.fieldErrors.debtorName) {
      errors.debtorName = currentValidation.fieldErrors.debtorName;
    }
    return errors;
  }, [
    showCaseNumberError,
    showDebtorNameError,
    currentValidation.fieldErrors.caseNumber,
    currentValidation.fieldErrors.debtorName,
  ]);

  const getChapters = useCallback(() => {
    const chapterArray: ComboOption[] = [];

    for (const item of ['7', '9', '11', '12', '13', '15']) {
      chapterArray.push({ label: item, value: item });
    }

    setChapterList(chapterArray);
  }, []);

  const getCourts = useCallback(() => {
    Api2.getCourts()
      .then((response) => {
        const newOfficesList = sortByCourtLocation(response.data);
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
    // TODO resolving this warning introduces an infinite loop. This may be a smell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalAlert]);

  function disableSearchForm(value: boolean) {
    caseNumberInputRef.current?.disable(value);
    debtorNameInputRef.current?.disable(value);
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

    setShowCaseNumberError(false);

    debounce(() => {
      setShowCaseNumberError(true);
    }, 300);
  }

  function handleDebtorNameChange(ev: ChangeEvent<HTMLInputElement>): void {
    const debtorName = ev.target.value;

    if (temporarySearchPredicate.debtorName != debtorName) {
      const newPredicate = { ...temporarySearchPredicate };

      if (debtorName) {
        newPredicate.debtorName = debtorName;
      } else {
        delete newPredicate.debtorName;
      }
      setTemporarySearchPredicate(newPredicate);
    }

    setShowDebtorNameError(false);

    debounce(() => {
      setShowDebtorNameError(true);
    }, 300);
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
    // Enable showing validation errors
    setShowCaseNumberError(true);
    setHasAttemptedSearch(true);

    // Build the predicate with current case number
    const currentPredicate = { ...temporarySearchPredicate };

    // Validate using current values
    const currentFormData = mapToFormData(currentPredicate);
    const validation = validateFormData(currentFormData);

    // Only perform search if validation passes
    if (validation.isValid) {
      setSearchPredicate(currentPredicate);
    }
  }

  function handleSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    performSearch();
  }

  const infoModalActionButtonGroup = {
    modalId: infoModalId,
    modalRef: infoModalRef as React.RefObject<ModalRefType | null>,
    cancelButton: {
      label: 'Return',
      uswdsStyle: UswdsButtonStyle.Default,
    },
  };

  useEffect(() => {
    getCourts();
    getChapters();
  }, [getCourts, getChapters]);

  return (
    <MainContent className="search-screen" data-testid="search">
      <DocumentTitle name="Case Search" />
      <div className="grid-row grid-gap-lg">
        <div className="grid-col-12">
          <h1>
            Case Search
            <ScreenInfoButton infoModalRef={infoModalRef} modalId={infoModalId} />
          </h1>
        </div>
      </div>
      <div className="grid-row grid-gap-lg search-pane">
        <div className="grid-col-3">
          <h2>Search By</h2>
          <form
            className="filter-and-search"
            data-testid="filter-and-search-panel"
            onSubmit={handleSubmit}
            role="search"
          >
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
                  allowPartialCaseNumber={true}
                  aria-label="Find case by Case Number."
                  ref={caseNumberInputRef}
                  errorMessage={fieldErrors.caseNumber?.reasons?.[0]}
                />
              </div>
            </div>
            {phoneticSearchEnabled && (
              <div className="debtor-name-search form-field" data-testid="debtor-name-search">
                <div className="usa-search usa-search--small">
                  <Input
                    id="debtor-name-search-field"
                    name="debtor-name-search"
                    label="Debtor Name"
                    autoComplete="off"
                    onChange={handleDebtorNameChange}
                    onFocus={handleFilterFormElementFocus}
                    aria-label="Find case by Debtor Name."
                    ref={debtorNameInputRef}
                    value={temporarySearchPredicate.debtorName || ''}
                    errorMessage={fieldErrors.debtorName?.reasons?.[0]}
                  />
                </div>
              </div>
            )}
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
            {hasAttemptedSearch && currentValidation.formValidationError && (
              <div className="search-validation-alert" data-testid="search-validation-alert">
                <Alert
                  message={currentValidation.formValidationError}
                  type={UswdsAlertStyle.Error}
                  show={true}
                  slim={true}
                  inline={true}
                  role="alert"
                ></Alert>
              </div>
            )}
            <div className="search-form-submit form-field">
              <Button
                id="search-submit"
                className="search-submit-button"
                uswdsStyle={UswdsButtonStyle.Default}
                type="submit"
                ref={submitButtonRef}
                disabled={!currentValidation.isValid}
              >
                Search
              </Button>
            </div>
          </form>
        </div>
        <div className="grid-col-8" role="status" aria-live="polite">
          <h2>Results</h2>
          {!isValidSearchPredicate(searchPredicate) && (
            <div className="search-alert">
              <Alert
                id="default-state-alert"
                message="Use the Search Filters to find cases."
                title="Enter search terms"
                type={UswdsAlertStyle.Info}
                show={true}
                inline={true}
                role="alert"
              ></Alert>
            </div>
          )}
          {isValidSearchPredicate(searchPredicate) && (
            <SearchResults
              id="search-results"
              searchPredicate={searchPredicate}
              phoneticSearchEnabled={phoneticSearchEnabled}
              showDebtorNameColumn={showDebtorNameColumn}
              onStartSearching={setStartSearching}
              onEndSearching={setEndSearching}
              header={SearchResultsHeader}
              row={SearchResultsRow}
            />
          )}
        </div>
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
