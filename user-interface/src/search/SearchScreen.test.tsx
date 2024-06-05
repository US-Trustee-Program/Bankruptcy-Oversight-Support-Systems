import { MockData } from '@common/cams/test-utilities/mock-data';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { CaseBasics, CaseSummary } from '@common/cams/cases';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SearchScreen from '@/search/SearchScreen';
import { selectItemInMockSelect } from '../lib/components/CamsSelectMulti.mock';
import { CasesSearchPredicate } from '@common/api/search';
import { buildResponseBodySuccess } from '@common/api/response';

vi.mock(
  '../lib/components/CamsSelectMulti',
  () => import('../lib/components/CamsSelectMulti.mock'),
);

describe('search screen', () => {
  let caseList: CaseSummary[];
  const getCaseSummarySpy = vi.spyOn(Chapter15MockApi, 'get');

  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    caseList = [MockData.getCaseSummary(), MockData.getCaseSummary()];
    getCaseSummarySpy.mockResolvedValue(buildResponseBodySuccess<CaseBasics[]>(caseList));
  });

  function renderWithoutProps() {
    render(
      <BrowserRouter>
        <SearchScreen></SearchScreen>
      </BrowserRouter>,
    );
  }

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

  test('should render a list of cases by court division', async () => {
    renderWithoutProps();

    let defaultStateAlert = document.querySelector('#default-state-alert');
    expect(defaultStateAlert).toBeInTheDocument();
    expect(defaultStateAlert).toBeVisible();

    await waitFor(() => {
      // Infer the office list is loaded from the API.
      expect(
        document.querySelector('#select-button-court-selections-search-1'),
      ).toBeInTheDocument();
    });

    let table = document.querySelector('#search-results > table');
    expect(table).not.toBeInTheDocument();

    selectItemInMockSelect('court-selections-search', 0);

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

    selectItemInMockSelect('court-selections-search', 1);
    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
      table = document.querySelector('#search-results > table');
      expect(table).not.toBeInTheDocument();
    });

    expect(getCaseSummarySpy).toHaveBeenCalledWith(
      '/cases',
      expect.objectContaining({ limit: 25, offset: 0, divisionCodes: expect.any(Array<string>) }),
    );
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
});
