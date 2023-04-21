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
  body: {
    staff1Label: 'Trial Attorney',
    staff2Label: 'Auditor',
    caseList: [
      {
        caseNumber: '22-481',
        currentChapterFileDate: 20230523,
        currentCaseChapter: '11',
        debtor1Name: 'John Doe',
        hearingCode: 'IDI',
        hearingDate: 20230501,
        hearingDisposition: 'Disposition info goes here.',
        hearingTime: 930,
        staff1ProfName: 'Debbie Jones',
        staff1ProfDescription: '',
        staff2ProfName: 'Frank Moore',
        staff2ProfDescription: '',
      },
      {
        caseNumber: '22-495',
        currentChapterFileDate: 20230607,
        currentCaseChapter: '11',
        debtor1Name: 'Jane Doe',
        hearingCode: 'IDI',
        hearingDate: 20230601,
        hearingDisposition: 'Disposition info goes here.',
        hearingTime: 1145,
        staff1ProfName: 'Jessie Thomas',
        staff1ProfDescription: '',
        staff2ProfName: 'Arnold Banks',
        staff2ProfDescription: '',
      },
      {
        caseNumber: '22-501',
        currentChapterFileDate: 20230607,
        currentCaseChapter: '11',
        debtor1Name: 'Roger Moore',
        hearingCode: 'IDI',
        hearingDate: 20230601,
        hearingDisposition: 'Disposition info goes here.',
        hearingTime: 1501,
        staff1ProfName: 'Jessie Thomas',
        staff1ProfDescription: '',
        staff2ProfName: 'John Jones',
        staff2ProfDescription: '',
      },
    ],
  },
};

const mockFetchList = () => {
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
        expect(tableRows).toHaveLength(mockCaseList.body.caseList.length + 1);
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
