import { MockData } from '@common/cams/test-utilities/mock-data';
import Chapter15MockApi from '@/lib/models/chapter15-mock.api.cases';
import { CaseSummary } from '@common/cams/cases';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SearchScreen from '@/search/SearchScreen';
import { selectItemInMockSelect } from '../lib/components/CamsSelect.mock';

vi.mock(
  '../lib/components/CamsSelectMulti',
  () => import('../lib/components/CamsSelectMulti.mock'),
);

describe('search screen', () => {
  let caseList: CaseSummary[];
  beforeEach(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    caseList = [MockData.getCaseSummary(), MockData.getCaseSummary()];
    vi.spyOn(Chapter15MockApi, 'post').mockResolvedValueOnce({
      message: '',
      count: caseList.length,
      body: caseList,
    });
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

    fireEvent.change(caseNumberInput, { target: { value: '00-11111' } });
    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
      table = document.querySelector('#search-results > table');
      expect(table).not.toBeInTheDocument();
    });
  });

  test('should render a list of cases by court division', async () => {
    renderWithoutProps();

    let defaultStateAlert = document.querySelector('#default-state-alert');
    expect(defaultStateAlert).toBeInTheDocument();
    expect(defaultStateAlert).toBeVisible();

    screen.debug();
    await waitFor(() => {
      // Infer the office list is loaded from the API.
      expect(document.querySelector('#court-selections-search-1')).toBeInTheDocument();
    });

    let table = document.querySelector('#search-results > table');
    expect(table).not.toBeInTheDocument();

    selectItemInMockSelect('court-selections-search', 1);

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

    // TODO: This is a multi select so we need to test it.
    selectItemInMockSelect('court-selections-search', 2);
    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
      table = document.querySelector('#search-results > table');
      expect(table).not.toBeInTheDocument();
    });
  });

  test('should show the no results alert when no results are available', async () => {
    renderWithoutProps();

    vi.spyOn(Chapter15MockApi, 'post').mockResolvedValueOnce({
      message: '',
      count: 0,
      body: [],
    });

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

    vi.spyOn(Chapter15MockApi, 'post').mockRejectedValueOnce({
      message: 'some error',
    });

    const caseNumberInput = screen.getByTestId('basic-search-field');

    let table = document.querySelector('#search-results > table');
    expect(table).not.toBeInTheDocument();
    let searchErrorAlert = document.querySelector('#search-error-alert');
    expect(searchErrorAlert).not.toBeInTheDocument();
    fireEvent.change(caseNumberInput, { target: { value: '00-00000' } });
    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).not.toBeInTheDocument();
      table = document.querySelector('#search-results > table');
      expect(table).not.toBeInTheDocument();
      searchErrorAlert = document.querySelector('#search-error-alert');
      expect(searchErrorAlert).toBeInTheDocument();
      expect(searchErrorAlert).toBeVisible();
    });

    fireEvent.change(caseNumberInput, { target: { value: '00-11111' } });
    await waitFor(() => {
      expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
      searchErrorAlert = document.querySelector('#search-error-alert');
      expect(searchErrorAlert).not.toBeInTheDocument();
    });
  });
});
