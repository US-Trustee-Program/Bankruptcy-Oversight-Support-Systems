import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { CaseAssignment } from './CaseAssignment';
import { store } from '../store/store';
import Chapter15MockApi from '../models/chapter15-mock.api.cases';
import { ResponseData } from '../type-declarations/api';
import { vi } from 'vitest';

//import { ObjectKeyVal } from '../type-declarations/basic';

// for UX, it might be good to put a time limit on the api call to return results, and display an appropriate screen message to user.
// for UX, do we want to limit number of results to display on screen (pagination discussion to table for now)

describe('CaseAssignment Component Tests', () => {
  beforeEach(() => {
    vi.stubEnv('CAMS_PA11Y', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /*
  // test that Loading... is displayed while we wait for the api to return data
  test('/cases renders "Loading..." while its fetching content from API', async () => {
    vi.spyOn(Chapter15MockApi, 'list' as never).mockImplementation(async () => {
      await setTimeout(() => {
        //
      }, 3000);
      Promise.resolve({
        message: 'not found',
        count: 0,
        body: {
          caseList: [],
        },
      });
    });

    render(
      <BrowserRouter>
        <Provider store={store}>
          <CaseAssignment />
        </Provider>
      </BrowserRouter>,
    );

    const loadingMsg = await screen.findAllByText('Loading...');
    expect(loadingMsg[0]).toBeInTheDocument();
  });
  */

  // if api.list returns an empty set, then screen should contain an empty table with valid header but no content
  test('/cases should contain an empty table with valid header but no table body when api.list returns an empty set', async () => {
    vi.spyOn(Chapter15MockApi, 'list')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .mockImplementation((_path: string): Promise<ResponseData> => {
        return Promise.resolve({
          message: 'not found',
          count: 0,
          body: {
            caseList: [],
          },
        });
      });

    render(
      <BrowserRouter>
        <Provider store={store}>
          <CaseAssignment />
        </Provider>
      </BrowserRouter>,
    );

    await waitFor(() => {
      const tableHeader = screen.getAllByRole('columnheader');
      expect(tableHeader[0].textContent).toBe('Case Number');
      expect(tableHeader[1].textContent).toBe('Case Title (Debtor)');
      expect(tableHeader[2].textContent).toBe('Filing Date');
      const tableBody = screen.getAllByTestId('case-assignment-table-body');
      const data = tableBody[0].querySelectorAll('tr');
      expect(data).toHaveLength(0);
    });
  });

  // if api.list returns more than 0 results, then all results will be displayed in table body content
  test('/cases should contain a valid list of cases in the table when api.list returns more than 0 results', async () => {
    vi.spyOn(Chapter15MockApi, 'list')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .mockImplementation((_path: string): Promise<ResponseData> => {
        return Promise.resolve({
          message: '',
          count: Chapter15MockApi.caseList.length,
          body: {
            caseList: Chapter15MockApi.caseList,
          },
        });
      });

    render(
      <BrowserRouter>
        <Provider store={store}>
          <CaseAssignment />
        </Provider>
      </BrowserRouter>,
    );

    await waitFor(
      async () => {
        const tableBody = screen.getAllByTestId('case-assignment-table-body');
        const data = tableBody[0].querySelectorAll('tr');
        expect(data.length).toBeGreaterThan(0);
      },
      { timeout: 1000 },
    );
  });

  test('should display assigned attorneys on the case after it is updated', async () => {
    vi.spyOn(Chapter15MockApi, 'list')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .mockImplementation((_path: string): Promise<ResponseData> => {
        return Promise.resolve({
          message: '',
          count: Chapter15MockApi.caseList.length,
          body: {
            caseList: Chapter15MockApi.caseList,
          },
        });
      });

    render(
      <BrowserRouter>
        <Provider store={store}>
          <CaseAssignment />
        </Provider>
      </BrowserRouter>,
    );

    const loadingMsg = await screen.findAllByText('Loading...');

    await waitFor(
      async () => {
        expect(loadingMsg[0]).not.toBeInTheDocument();
      },
      { timeout: 1000 },
    );

    const tableBody = screen.getAllByTestId('case-assignment-table-body');
    const data = tableBody[0].querySelectorAll('tr');
    expect(data.length).toBeGreaterThan(0);

    // open modal, select attorneys, submit, validate
    const assignButton = screen.getByTestId('toggle-modal-button-1');
    act(() => {
      fireEvent.click(assignButton);
    });

    const checkbox1 = screen.getByTestId('checkbox-1-checkbox');
    const checkbox2 = screen.getByTestId('checkbox-2-checkbox');

    act(() => {
      fireEvent.click(checkbox1);
      fireEvent.click(checkbox2);
    });

    const submitButton = screen.getByTestId('toggle-modal-button-submit');
    act(() => {
      fireEvent.click(submitButton);
    });

    const alert = screen.getByTestId('alert');
    expect(alert).toHaveClass('usa-alert__visible');
    expect(alert).toHaveAttribute('role', 'status');
    expect(alert).toHaveClass('usa-alert--info');
    const alertMessage = screen.getByTestId('alert-message');
    expect(alertMessage).toContainHTML('Test alert message');
  });
});
