import { render, screen, waitForElementToBeRemoved } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from '../../src/App';

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

const mockFetchList = () =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockCaseList),
  } as Response);

describe('Base App Tests', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchMock: any = undefined;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch').mockImplementation(mockFetchList);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('/ renders Case List', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    expect(fetchMock).toHaveBeenCalled();
    await waitForElementToBeRemoved(() => screen.queryByText('Loading...'));

    const h1 = screen.getByText(/Case List/i);
    expect(h1).toBeInTheDocument();

    const tableHeader = screen.getAllByRole('columnheader');
    expect(tableHeader[0].textContent).toBe('Case Div');
    expect(tableHeader[1].textContent).toBe('Case Year');
    expect(tableHeader[2].textContent).toBe('Case Number');
    expect(tableHeader[3].textContent).toBe('Chapter');
    expect(tableHeader[4].textContent).toBe('Staff 1');
    expect(tableHeader[5].textContent).toBe('Staff 2');

    const tableRows = screen.getAllByRole('row');
    expect(tableRows).toHaveLength(mockCaseList.body.length + 1);
  });
});
