import { MockData } from '@common/cams/test-utilities/mock-data';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { CaseBasics, CaseSummary } from '@common/cams/cases';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SearchScreen from '@/search/SearchScreen';
import { CasesSearchPredicate } from '@common/api/search';
import { buildResponseBodySuccess } from '@common/api/response';

describe('search screen', () => {
  let caseList: CaseSummary[];
  const getCaseSummarySpy = vi.spyOn(Chapter15MockApi, 'get');

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    caseList = [MockData.getCaseSummary(), MockData.getCaseSummary()];
    getCaseSummarySpy.mockResolvedValue(buildResponseBodySuccess<CaseBasics[]>(caseList));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function renderWithoutProps() {
    render(
      <BrowserRouter>
        <SearchScreen></SearchScreen>
      </BrowserRouter>,
    );
  }
  test('should render a list of cases by chapter number', async () => {
    const divisionSearchPredicate = {
      limit: 25,
      offset: 0,
      chapters: expect.any(Array<string>),
    };

    renderWithoutProps();

    const loadingSpinner = document.querySelector('.loading-spinner');
    let defaultStateAlert = document.querySelector('#default-state-alert');
    expect(defaultStateAlert).toBeInTheDocument();
    expect(defaultStateAlert).toBeVisible();

    let table = document.querySelector('#search-results > table');
    expect(table).not.toBeInTheDocument();
    const expandButton = screen.getByTestId('button-case-chapter-search-expand');

    await waitFor(() => {
      expect(document.querySelector('#case-chapter-search-item-list')).toBeInTheDocument();
    });

    // Make first search request....
    fireEvent.click(expandButton!);
    const chapterElevenOptionButton = screen.getByTestId('combo-box-option-11');
    fireEvent.click(chapterElevenOptionButton);
    fireEvent.click(expandButton!);

    await waitFor(() => {
      // wait for loading to appear and default state alert to be removed
      defaultStateAlert = document.querySelector('#default-state-alert');
      expect(defaultStateAlert).not.toBeInTheDocument();
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    });
    await waitFor(() => {
      // wait for loading to disappear
      expect(loadingSpinner).not.toBeInTheDocument();
      table = document.querySelector('#search-results > table');
      expect(table).toBeVisible();
    });
    const rows = document.querySelectorAll('#search-results-table-body > tr');
    expect(rows).toHaveLength(caseList.length);

    expect(getCaseSummarySpy).toHaveBeenLastCalledWith(
      '/cases',
      expect.objectContaining(divisionSearchPredicate),
    );

    // Make second search request...
    fireEvent.click(expandButton!);
    const chapterTwelveOptionButton = screen.getByTestId('combo-box-option-12');
    fireEvent.click(chapterTwelveOptionButton);
    fireEvent.click(expandButton!);
    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
      table = document.querySelector('#search-results > table');
      expect(table).not.toBeInTheDocument();
    });
    await waitFor(() => {
      // wait for loading to disappear
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      table = document.querySelector('#search-results > table');
      expect(table).toBeVisible();
    });

    expect(getCaseSummarySpy).toHaveBeenLastCalledWith(
      '/cases',
      expect.objectContaining(divisionSearchPredicate),
    );
  });

  test('should render a list of cases by court division', async () => {
    const divisionSearchPredicate = {
      limit: 25,
      offset: 0,
      divisionCodes: expect.any(Array<string>),
    };

    renderWithoutProps();

    const loadingSpinner = document.querySelector('.loading-spinner');
    const defaultStateAlert = document.querySelector('#default-state-alert');
    expect(defaultStateAlert).toBeInTheDocument();
    expect(defaultStateAlert).toBeVisible();

    let table = document.querySelector('#search-results > table');
    expect(table).not.toBeInTheDocument();
    const expandButton = screen.getByTestId('button-court-selections-search-expand');

    await waitFor(() => {
      expect(expandButton).toBeInTheDocument();
      fireEvent.click(expandButton);
    });

    let divisionItemLi: HTMLElement;
    let divisionText: string;
    let divisionItemBtn: HTMLElement;

    // Make first search request....
    await waitFor(() => {
      divisionItemLi = screen.getByTestId('court-selections-search-item-0');
      divisionText = divisionItemLi.textContent!;
      divisionItemBtn = screen.getByTestId(`combo-box-option-${divisionText}`);
      expect(divisionItemLi).toBeInTheDocument();
      expect(divisionItemBtn).toBeInTheDocument();
      fireEvent.click(divisionItemBtn);
    });

    await waitFor(() => {
      expect(divisionItemLi).toHaveClass('selected');
    });
    fireEvent.click(expandButton);
    await waitFor(() => {
      const expandedList = document.querySelector('.item-list-container .expanded');
      expect(expandedList).not.toBeInTheDocument();
    });

    await waitFor(() => {
      // wait for loading to appear and default state alert to be removed
      expect(defaultStateAlert).not.toBeVisible();
    });
    await waitFor(() => {
      // wait for loading to disappear
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      table = document.querySelector('#search-results > table');
      expect(table).toBeVisible();
    });
    const rows = document.querySelectorAll('#search-results-table-body > tr');
    expect(rows).toHaveLength(caseList.length);

    expect(getCaseSummarySpy).toHaveBeenLastCalledWith(
      '/cases',
      expect.objectContaining(divisionSearchPredicate),
    );

    // Make second search request...

    await waitFor(() => {
      fireEvent.click(expandButton);
    });

    divisionItemLi = screen.getByTestId('court-selections-search-item-1'); // select second option

    divisionText = divisionItemLi.textContent!;
    divisionItemBtn = screen.getByTestId(`combo-box-option-${divisionText}`);

    // Make first search request....
    await waitFor(() => {
      expect(divisionItemLi).toBeInTheDocument();
      expect(divisionItemBtn).toBeInTheDocument();
      fireEvent.click(divisionItemBtn);
    });

    await waitFor(() => {
      expect(divisionItemLi).toHaveClass('selected');
    });
    fireEvent.click(expandButton);
    await waitFor(() => {
      const expandedList = document.querySelector('.item-list-container .expanded');
      expect(expandedList).not.toBeInTheDocument();
    });
    await waitFor(() => {
      // wait for loading to disappear
      expect(loadingSpinner).not.toBeInTheDocument();
      table = document.querySelector('#search-results > table');
      expect(table).toBeVisible();
    });

    expect(getCaseSummarySpy).toHaveBeenLastCalledWith(
      '/cases',
      expect.objectContaining(divisionSearchPredicate),
    );
  });

  test('should render a list of cases by case number', async () => {
    renderWithoutProps();

    let defaultStateAlert = document.querySelector('#default-state-alert');
    expect(defaultStateAlert).toBeInTheDocument();
    expect(defaultStateAlert).toBeVisible();
    const caseNumberInput = screen.getByTestId('basic-search-field');
    expect(caseNumberInput).toBeInTheDocument();
    expect(caseNumberInput).toBeEnabled();

    let table = document.querySelector('#search-results > table');
    expect(table).not.toBeInTheDocument();
    fireEvent.change(caseNumberInput, { target: { value: '00-00000' } });
    await waitFor(() => {
      // wait for loading to appear and default state alert to be removed
      defaultStateAlert = document.querySelector('#default-state-alert');
      expect(defaultStateAlert).not.toBeInTheDocument();
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    });
    await waitFor(() => {
      // wait for loading to disappear
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      table = document.querySelector('#search-results > table');
      expect(table).toBeVisible();
    });
    const rows = document.querySelectorAll('#search-results-table-body > tr');
    expect(rows).toHaveLength(caseList.length);

    const caseNumber = '00-11111';
    fireEvent.change(caseNumberInput, { target: { value: caseNumber } });
    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
      table = document.querySelector('#search-results > table');
      expect(table).not.toBeInTheDocument();
    });

    const casesSearchPredicate: CasesSearchPredicate = {
      caseNumber,
      limit: 25,
      offset: 0,
    };
    expect(getCaseSummarySpy).toHaveBeenCalledWith('/cases', casesSearchPredicate);
  });

  test('should only search for full case number', async () => {
    renderWithoutProps();

    let defaultStateAlert = document.querySelector('#default-state-alert');
    expect(defaultStateAlert).toBeInTheDocument();
    expect(defaultStateAlert).toBeVisible();
    const caseNumberInput = screen.getByTestId('basic-search-field');
    expect(caseNumberInput).toBeInTheDocument();
    expect(caseNumberInput).toBeEnabled();

    let table = document.querySelector('#search-results > table');
    expect(table).not.toBeInTheDocument();
    fireEvent.change(caseNumberInput, { target: { value: '00-00000' } });
    await waitFor(() => {
      // wait for loading to appear and default state alert to be removed
      defaultStateAlert = document.querySelector('#default-state-alert');
      expect(defaultStateAlert).not.toBeInTheDocument();
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
    });
    await waitFor(() => {
      // wait for loading to disappear
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      table = document.querySelector('#search-results > table');
      expect(table).toBeVisible();
    });
    const rows = document.querySelectorAll('#search-results-table-body > tr');
    expect(rows).toHaveLength(caseList.length);

    const caseNumber = '';
    fireEvent.change(caseNumberInput, { target: { value: caseNumber } });
    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      table = document.querySelector('#search-results > table');
      expect(table).not.toBeInTheDocument();
      expect(screen.getByTestId('alert-message-default-state-alert')).toBeInTheDocument();
    });

    expect(getCaseSummarySpy.mock.calls).toHaveLength(2);
  });

  test('should show the no results alert when no results are available', async () => {
    renderWithoutProps();

    vi.spyOn(Chapter15MockApi, 'get').mockResolvedValueOnce(
      buildResponseBodySuccess<CaseBasics[]>([]),
    );

    const caseNumberInput = screen.getByTestId('basic-search-field');

    let table = document.querySelector('#search-results > table');
    expect(table).not.toBeInTheDocument();
    let noResultsAlert = document.querySelector('#no-results-alert');
    expect(noResultsAlert).not.toBeInTheDocument();
    fireEvent.change(caseNumberInput, { target: { value: '00-00000' } });
    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      table = document.querySelector('#search-results > table');
      expect(table).not.toBeInTheDocument();
      noResultsAlert = document.querySelector('#no-results-alert');
      expect(noResultsAlert).toBeInTheDocument();
      expect(noResultsAlert).toBeVisible();
    });

    fireEvent.change(caseNumberInput, { target: { value: '00-11111' } });
    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
      noResultsAlert = document.querySelector('#no-results-alert');
      expect(noResultsAlert).not.toBeInTheDocument();
    });
  });

  test('should show the error alert when an error is encountered', async () => {
    renderWithoutProps();

    vi.spyOn(Chapter15MockApi, 'get')
      .mockRejectedValueOnce({
        message: 'some error',
      })
      .mockResolvedValue(buildResponseBodySuccess<CaseBasics[]>(caseList));

    const caseNumberInput = screen.getByTestId('basic-search-field');

    expect(document.querySelector('#search-error-alert')).not.toBeInTheDocument();

    fireEvent.change(caseNumberInput, { target: { value: '00-00000' } });
    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      expect(document.querySelector('#search-results > table')).not.toBeInTheDocument();

      const searchErrorAlert = document.querySelector('#search-error-alert');
      expect(searchErrorAlert).toBeInTheDocument();
      expect(searchErrorAlert).toBeVisible();
    });

    fireEvent.change(caseNumberInput, { target: { value: '00-11111' } });
    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      expect(document.querySelector('#search-results > table')).toBeInTheDocument();
      const searchErrorAlert = document.querySelector('#search-error-alert');
      expect(searchErrorAlert).not.toBeInTheDocument();
    });
  });

  test('should show an error alert if offices cannot be retrieved from API', async () => {
    vi.spyOn(Chapter15MockApi, 'get')
      .mockRejectedValueOnce({
        message: 'some error',
      })
      .mockResolvedValue(buildResponseBodySuccess<CaseBasics[]>(caseList));

    renderWithoutProps();

    await waitFor(() => {
      const searchErrorAlert = screen.getByTestId('alert-message');
      expect(searchErrorAlert).toBeInTheDocument();
      expect(searchErrorAlert).toBeVisible();
      expect(searchErrorAlert).toHaveTextContent('Cannot load office list');
    });
  });
});
