import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { store } from '../../src/store/store';
import { Provider } from 'react-redux';
import { CaseList } from '../../src/components/CaseList';

const mockCaseList = {
  success: true,
  message: 'cases list',
  count: 99,
  body: [
    {
      CASE_DIV: 481,
      CASE_YEAR: 22,
      CASE_NUMBER: 91419,
      STAFF1_PROF_CODE: 2416,
      STAFF2_PROF_CODE: 2675,
      CURR_CASE_CHAPT: '11',
    },
    {
      CASE_DIV: 481,
      CASE_YEAR: 22,
      CASE_NUMBER: 93500,
      STAFF1_PROF_CODE: 2416,
      STAFF2_PROF_CODE: 2675,
      CURR_CASE_CHAPT: '11',
    },
  ],
};

const mockFetchList = () => {
  console.log('mocking fetch...');
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockCaseList),
  } as Response);
};

describe('Base App Tests', () => {
  test('/ renders Case List', async () => {
    render(
      <BrowserRouter>
        <Provider store={store}>
          <CaseList />
        </Provider>
      </BrowserRouter>,
    );

    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(mockFetchList);
    const loadingMsg = await screen.findAllByText('Loading...');

    let h1 = screen.getByText(/^Case List$/i);
    expect(h1).toBeInTheDocument();
    expect(loadingMsg[0]).toBeInTheDocument();

    await waitFor(
      async () => {
        expect(fetchMock).toHaveBeenCalled();
        expect(loadingMsg[0]).not.toBeInTheDocument();

        h1 = screen.getByTestId('case-list-heading');
        expect(h1.textContent).toBe('Case List for any staff chapter 11');

        const tableHeader = screen.getAllByRole('columnheader');
        expect(tableHeader[4].textContent).toBe('Case Div');
        expect(tableHeader[5].textContent).toBe('Case Year');
        expect(tableHeader[6].textContent).toBe('Case Number');
        expect(tableHeader[7].textContent).toBe('Chapter');
        expect(tableHeader[8].textContent).toBe('Group Designator');
        expect(tableHeader[9].textContent).toBe('Professional Code');

        const tableRows = screen.getAllByRole('row');
        expect(tableRows).toHaveLength(mockCaseList.body.length + 2);
      },
      { timeout: 100 },
    );
  });
});
