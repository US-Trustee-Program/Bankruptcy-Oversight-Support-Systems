import { useEffect, useState } from 'react';
import {
  CasesSearchPredicate,
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_OFFSET,
} from '@common/api/search';
import { OfficeDetails } from '@common/cams/courts';
import CaseNumberInput from '@/lib/components/CaseNumberInput';
import { useApi2 } from '@/lib/hooks/UseApi2';
import { getOfficeList } from '@/data-verification/dataVerificationHelper';
import { officeSorter } from '@/data-verification/DataVerificationScreen';
import { isValidSearchPredicate, SearchResults } from '@/search/SearchResults';
import Alert, { AlertProps, UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import ComboBox, { ComboOption } from '@/lib/components/combobox/ComboBox';
import './SearchScreen.scss';

type InputState = {
  disabled: boolean;
};

type SearchScreenState = {
  searchPredicate: CasesSearchPredicate;
  chapterList: ComboOption[];
  officesList: OfficeDetails[];
  errorAlert: AlertProps;
  form: {
    caseNumberInput: InputState;
    courtSelection: InputState;
    chapterSelection: InputState;
  };
};

type SearchScreenActions = {
  getChapters: () => void;
  getOffices: () => void;
  disableSearchForm: (value: boolean) => void;
  handleCaseNumberChange: (caseNumber?: string) => void;
  handleCourtSelection: (selection: ComboOption[]) => void;
  handleChapterSelection: (selections: ComboOption[]) => void;
};

// function useCamsActions<A, S>(initialState: S): { actions: A; state: S } {
//   const [state, setState] = useState<S>(initialState);
//   const actions: A = {} as A;
//   setState({} as S);
//   return {
//     state,
//     actions,
//   };
// }

function useSearchScreenActionsAndState(initialState: SearchScreenState): {
  actions: SearchScreenActions;
  state: SearchScreenState;
} {
  const [state, setState] = useState<SearchScreenState>(initialState);

  const api = useApi2();

  function getChapters() {
    const chapterArray: ComboOption[] = [];

    for (const item of ['7', '9', '11', '12', '13', '15']) {
      chapterArray.push({ label: item, value: item, selected: false });
    }

    state.chapterList = chapterArray;
    setState(state);
  }

  async function getOffices() {
    api
      .getOffices()
      .then((response) => {
        state.officesList = response.data.sort(officeSorter);
      })
      .catch(() => {
        state.errorAlert = {
          ...DEFAULT_ALERT,
          title: 'Error',
          message: 'Cannot load office list',
          show: true,
        };
      });
    setState(state);
  }

  function disableSearchForm(value: boolean) {
    state.form.caseNumberInput.disabled = value;
    state.form.courtSelection.disabled = value;
    state.form.chapterSelection.disabled = value;
    setState(state);
  }

  function handleCaseNumberChange(caseNumber?: string): void {
    if (state.searchPredicate.caseNumber != caseNumber) {
      const newPredicate = { ...state.searchPredicate, caseNumber };
      if (!caseNumber) delete newPredicate.caseNumber;
      state.searchPredicate = newPredicate;
      setState(state);
    }
  }

  function handleCourtSelection(selection: ComboOption[]) {
    const newPredicate = {
      ...state.searchPredicate,
    };
    delete newPredicate.divisionCodes;
    if (selection.length) {
      newPredicate.divisionCodes = selection.map((kv: ComboOption) => kv.value);
    }
    state.searchPredicate = newPredicate;
    setState(state);
  }

  function handleChapterSelection(selections: ComboOption[]) {
    const { searchPredicate } = state;
    let performSearch = false;

    if (searchPredicate.chapters && searchPredicate.chapters.length == selections.length) {
      selections.forEach((chapter) => {
        if (searchPredicate.chapters && !searchPredicate.chapters.includes(chapter.value)) {
          performSearch = true;
        }
      });
    } else {
      performSearch = true;
    }

    if (performSearch) {
      const newPredicate = {
        ...searchPredicate,
      };
      delete newPredicate.chapters;

      if (selections.length) {
        newPredicate.chapters = selections.map((option: ComboOption) => option.value);
      }

      state.searchPredicate = newPredicate;
      setState(state);
    }
  }

  const actions = {
    getChapters,
    getOffices,
    disableSearchForm,
    handleCaseNumberChange,
    handleCourtSelection,
    handleChapterSelection,
  };

  return {
    state,
    actions,
  };
}

const DEFAULT_ALERT = {
  show: false,
  title: '',
  message: '',
  type: UswdsAlertStyle.Error,
  timeout: 5,
};

export default function SearchScreen() {
  const initialState: SearchScreenState = {
    searchPredicate: {
      limit: DEFAULT_SEARCH_LIMIT,
      offset: DEFAULT_SEARCH_OFFSET,
    },
    chapterList: [],
    officesList: [],
    errorAlert: DEFAULT_ALERT,
    form: {
      caseNumberInput: { disabled: false },
      chapterSelection: { disabled: false },
      courtSelection: { disabled: false },
    },
  };
  const { actions, state } = useSearchScreenActionsAndState(initialState);

  useEffect(() => {
    actions.getOffices();
    actions.getChapters();
  }, []);

  return (
    <div className="search-screen" data-testid="search">
      <Alert inline={false} {...state.errorAlert}></Alert>
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
                  onChange={actions.handleCaseNumberChange}
                  allowEnterKey={true}
                  allowPartialCaseNumber={false}
                  disabled={state.form.caseNumberInput.disabled}
                />
              </div>
            </div>
            <div className="case-district-search form-field" data-testid="case-district-search">
              <div className="usa-search usa-search--small">
                <ComboBox
                  id={'court-selections-search'}
                  className="new-court__select"
                  label="District (Division)"
                  ariaLabelPrefix="District (Division)"
                  onClose={actions.handleCourtSelection}
                  onPillSelection={actions.handleCourtSelection}
                  options={getOfficeList(state.officesList)}
                  required={false}
                  multiSelect={true}
                  wrapPills={true}
                  disabled={state.form.courtSelection.disabled}
                />
              </div>
            </div>
            <div className="case-chapter-search form-field" data-testid="case-chapter-search">
              <div className="usa-search usa-search--small">
                <ComboBox
                  id={'case-chapter-search'}
                  className="case-chapter__select"
                  label="Chapter"
                  ariaLabelPrefix="Chapter"
                  onClose={actions.handleChapterSelection}
                  onPillSelection={actions.handleChapterSelection}
                  options={state.chapterList}
                  required={false}
                  multiSelect={true}
                  disabled={state.form.chapterSelection.disabled}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="grid-col-8">
          <h2>Results</h2>
          {!isValidSearchPredicate(state.searchPredicate) && (
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
          {isValidSearchPredicate(state.searchPredicate) && (
            <SearchResults
              id="search-results"
              searchPredicate={state.searchPredicate}
              onStartSearching={() => {
                actions.disableSearchForm(true);
              }}
              onEndSearching={() => {
                actions.disableSearchForm(false);
              }}
            />
          )}
        </div>
        <div className="grid-col-1"></div>
      </div>
    </div>
  );
}
