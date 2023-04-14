import { render, screen, waitFor, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { addUser } from '../../src/store/features/UserSlice';
import { useAppDispatch } from '../../src/store/store';
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
      CASE_YEAR_AND_NUMBER: '22-481',
      CURRENT_CHAPTER_FILE_DATE: 20230523,
      CURR_CASE_CHAPT: '11',
      DEBTOR1_NAME: 'John Doe',
      HEARING_CODE: 'IDI',
      HEARING_DATE: 20230501,
      HEARING_DISP: 'Disposition info goes here.',
      HEARING_TIME: 930,
      STAFF1_PROF_NAME: 'Debbie Jones',
      STAFF1_PROF_TYPE_DESC: '',
      STAFF2_PROF_NAME: 'Frank Moore',
      STAFF2_PROF_TYPE_DESC: '',
    },
    {
      CASE_YEAR_AND_NUMBER: '22-495',
      CURRENT_CHAPTER_FILE_DATE: 20230607,
      CURR_CASE_CHAPT: '11',
      DEBTOR1_NAME: 'Jane Doe',
      HEARING_CODE: 'IDI',
      HEARING_DATE: 20230601,
      HEARING_DISP: 'Disposition info goes here.',
      HEARING_TIME: 1145,
      STAFF1_PROF_NAME: 'Jessie Thomas',
      STAFF1_PROF_TYPE_DESC: '',
      STAFF2_PROF_NAME: 'Arnold Banks',
      STAFF2_PROF_TYPE_DESC: '',
    },
    {
      CASE_YEAR_AND_NUMBER: '22-501',
      CURRENT_CHAPTER_FILE_DATE: 20230607,
      CURR_CASE_CHAPT: '11',
      DEBTOR1_NAME: 'Roger Moore',
      HEARING_CODE: 'IDI',
      HEARING_DATE: 20230601,
      HEARING_DISP: 'Disposition info goes here.',
      HEARING_TIME: 1145,
      STAFF1_PROF_NAME: 'Jessie Thomas',
      STAFF1_PROF_TYPE_DESC: '',
      STAFF2_PROF_NAME: 'John Jones',
      STAFF2_PROF_TYPE_DESC: '',
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
  test('/cases renders Full Case List (All staff)', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(mockFetchList);

    render(
      <BrowserRouter>
        <Provider store={store}>
          <CaseList />
        </Provider>
      </BrowserRouter>,
    );

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
        expect(tableHeader[0].textContent).toBe('Case Number');
        expect(tableHeader[1].textContent).toBe('Debtor Name');
        expect(tableHeader[2].textContent).toBe('Current Chapter Date');
        expect(tableHeader[3].textContent).toBe('Hearing Code');
        expect(tableHeader[4].textContent).toBe('Initial Hearing Date/Time');
        expect(tableHeader[5].textContent).toBe('Hearing Disposition');
        expect(tableHeader[6].textContent).toBe('Trial Attorney');
        expect(tableHeader[7].textContent).toBe('Auditor');

        const tableRows = screen.getAllByRole('row');
        expect(tableRows).toHaveLength(mockCaseList.body.length + 1);
      },
      { timeout: 100 },
    );
  });

  test('/cases renders Case List for given staff member', async () => {
    const firstName = 'Jessie';
    const lastName = 'Thomas';
    const userData = { id: 123, firstName, lastName };
    const userWrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    renderHook(
      () => {
        const dispatch = useAppDispatch();
        dispatch(addUser(userData));
      },
      {
        wrapper: userWrapper,
      },
    );
    jest.spyOn(global, 'fetch').mockImplementation(mockFetchList);

    render(
      <BrowserRouter>
        <Provider store={store}>
          <CaseList />
        </Provider>
      </BrowserRouter>,
    );

    await waitFor(
      async () => {
        const h1 = screen.getByTestId('case-list-heading');
        expect(h1.textContent).toBe(`Case List for ${firstName} ${lastName} chapter 11`);
      },
      { timeout: 100 },
    );
  });
});
