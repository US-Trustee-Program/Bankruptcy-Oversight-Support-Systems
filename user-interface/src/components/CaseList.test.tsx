import { render, screen, waitFor, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { addUser } from '../store/features/UserSlice';
import { useAppDispatch } from '../store/store';
import { BrowserRouter } from 'react-router-dom';
import { store } from '../store/store';
import { Provider } from 'react-redux';
import { CaseList } from './CaseList';
import Chapter11MockApi from '../models/chapter11-mock.api.cases';
import { ResponseData } from '../models/api';

describe('CaseList Component Tests', () => {
  test('/cases renders "Loading..." while its fetching content from API', async () => {
    render(
      <BrowserRouter>
        <Provider store={store}>
          <CaseList />
        </Provider>
      </BrowserRouter>,
    );

    const loadingMsg = await screen.findAllByText('Loading...');
    expect(loadingMsg[0]).toBeInTheDocument();
  });

  test('/cases renders Full Case List (All staff)', async () => {
    jest
      .spyOn(Chapter11MockApi, 'list')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .mockImplementation((_path: string): Promise<ResponseData> => {
        return Promise.resolve({
          message: '',
          count: Chapter11MockApi.caseList.length,
          body: {
            caseList: Chapter11MockApi.caseList,
          },
        });
      });

    render(
      <BrowserRouter>
        <Provider store={store}>
          <CaseList />
        </Provider>
      </BrowserRouter>,
    );

    const loadingMsg = await screen.findAllByText('Loading...');

    await waitFor(
      async () => {
        expect(loadingMsg[0]).not.toBeInTheDocument();

        const h1 = screen.getByTestId('case-list-heading');
        expect(h1.textContent).toBe('Case List for any staff chapter 11');

        const tableHeader = screen.getAllByRole('columnheader');
        expect(tableHeader[0].textContent).toBe('Case Number');
        expect(tableHeader[1].textContent).toBe('Debtor Name');
        expect(tableHeader[2].textContent).toBe('Current Chapter Date');
        expect(tableHeader[3].textContent).toBe('Hearing Code');
        expect(tableHeader[4].textContent).toBe('Hearing Date and Time');
        expect(tableHeader[5].textContent).toBe('Hearing Disposition');

        const tableBody = screen.getAllByTestId('case-list-table-body');
        const tableRows = tableBody[0].querySelectorAll('tr');
        expect(tableRows).toHaveLength(Chapter11MockApi.caseList.length);
      },
      { timeout: 100 },
    );
  });

  test('/cases renders Case List for given staff member', async () => {
    const firstName = 'Ashley';
    const lastName = 'Rodriquez';
    const userData = { id: 1, firstName, lastName };
    const userWrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const caseList = Chapter11MockApi.caseList.filter((caseRecord) => {
      return [caseRecord.staff1ProfId, caseRecord.staff1ProfId].includes(`${userData.id}`);
    });

    jest
      .spyOn(Chapter11MockApi, 'list')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .mockImplementation((_path: string): Promise<ResponseData> => {
        return Promise.resolve({
          message: '',
          count: caseList.length,
          body: {
            caseList: caseList,
          },
        });
      });

    renderHook(
      () => {
        const dispatch = useAppDispatch();
        dispatch(addUser(userData));
      },
      {
        wrapper: userWrapper,
      },
    );

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

        const tableBody = screen.getAllByTestId('case-list-table-body');
        const tableRows = tableBody[0].querySelectorAll('tr');
        expect(tableRows).toHaveLength(caseList.length);
      },
      { timeout: 100 },
    );
  });
});
