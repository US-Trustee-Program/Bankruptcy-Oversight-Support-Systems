import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { CaseAssignment } from './CaseAssignment';
import { store } from '../store/store';
import Chapter15MockApi from '../models/chapter15-mock.api.cases';
import { ResponseData } from '../type-declarations/api';
import { vi } from 'vitest';
import * as httpAdapter from '../components/utils/http.adapter';

//import { ObjectKeyVal } from '../type-declarations/basic';

// for UX, it might be good to put a time limit on the api call to return results, and display an appropriate screen message to user.
// for UX, do we want to limit number of results to display on screen (pagination discussion to table for now)

const sleep = (milliseconds: number) =>
  new Promise((callback) => setTimeout(callback, milliseconds));

describe('CaseAssignment Component Tests', () => {
  beforeEach(() => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    vi.resetAllMocks();
  });

  beforeAll(() => {
    vi.mock('../models/attorneys-api', () => {
      return {
        default: {
          getAttorneys: async () => {
            return [
              {
                firstName: 'Martha',
                middleName: '',
                lastName: 'Mock',
                generation: '',
                office: 'Manhattan',
              },
              {
                firstName: 'John',
                middleName: '',
                lastName: 'Doe',
                generation: '',
                office: 'Manhattan',
              },
              {
                firstName: 'Roger',
                middleName: '',
                lastName: 'Wilco',
                generation: '',
                office: 'Manhattan',
              },
              {
                firstName: 'Obi',
                middleName: 'Wan',
                lastName: 'Kenobi',
                generation: '',
                office: 'Manhattan',
              },
            ];
          },
        },
      };
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /*
  // test that Loading... is displayed while we wait for the api to return data
  test('/cases renders "Loading..." while its fetching content from API', async () => {
    vi.spyOn(Chapter15MockApi, 'list' as never).mockImplementation(async () => {
      await setTimeout(() => {
        Promise.resolve({
          message: 'not found',
          count: 0,
          body: {
            caseList: [],
          },
        });
      }, 3000);
    });

    render(
      <BrowserRouter>
        <Provider store={store}>
          <CaseAssignment />
        </Provider>
      </BrowserRouter>,
    );

    let loadingMsg: HTMLElement;
    await waitFor(() => {
      loadingMsg = screen.getByTestId('loading-indicator');
    }).then(() => {
      expect(loadingMsg).toBeInTheDocument();
    });
  });
  */

  test('Case Assignment should display Region and Office of the AUST who logs in', async () => {
    render(
      <BrowserRouter>
        <Provider store={store}>
          <CaseAssignment />
        </Provider>
      </BrowserRouter>,
    );

    await waitFor(
      async () => {
        const subtitle = await screen.getByTestId('case-list-subtitle');
        expect(subtitle.textContent).toBe('Region 2 (Manhattan Office)');
      },
      { timeout: 3000 },
    );
  });

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
        const tableBody = await screen.getAllByTestId('case-assignment-table-body');
        const data = tableBody[0].querySelectorAll('tr');
        expect(data.length).toBeGreaterThan(0);
      },
      { timeout: 1000 },
    );
  });

  test('should display success alert after creating assignments', async () => {
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

    let assignButton: HTMLButtonElement;
    await waitFor(
      async () => {
        assignButton = screen.getByTestId('toggle-modal-button-1');
        expect(assignButton).toBeInTheDocument();
      },
      { timeout: 150 },
    ).then(() => {
      act(() => {
        fireEvent.click(assignButton);
      });
    });

    await waitFor(
      () => {
        expect(screen.getByTestId('checkbox-1-checkbox')).toBeInTheDocument();
      },
      { timeout: 100 },
    );

    const checkbox1 = screen.getByTestId('checkbox-1-checkbox');
    const checkbox2 = screen.getByTestId('checkbox-2-checkbox');

    act(() => {
      fireEvent.click(checkbox1);
      fireEvent.click(checkbox2);
    });

    vi.spyOn(httpAdapter, 'httpPost').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve('{"message": "success","count": 5,"body": ["1"]}'),
      headers: new Headers(),
      redirected: false,
      status: 0,
      statusText: '',
      type: 'error',
      url: '',
      clone: function (): Response {
        throw new Error('Function not implemented.');
      },
      body: null,
      bodyUsed: false,
      arrayBuffer: function (): Promise<ArrayBuffer> {
        throw new Error('Function not implemented.');
      },
      blob: function (): Promise<Blob> {
        throw new Error('Function not implemented.');
      },
      formData: function (): Promise<FormData> {
        throw new Error('Function not implemented.');
      },
      text: function (): Promise<string> {
        throw new Error('Function not implemented.');
      },
    });

    const submitButton = screen.getByTestId('toggle-modal-button-submit');
    act(() => {
      fireEvent.click(submitButton);
    });

    const alert = screen.getByTestId('alert');
    const alertMessage = screen.getByTestId('alert-message');

    await waitFor(
      () => {
        expect(alert).toHaveClass('usa-alert__visible');
      },
      { timeout: 5 },
    ).then(() => {
      expect(alert).toHaveAttribute('role', 'status');
      expect(alert).toHaveClass('usa-alert--success');
      expect(alertMessage).toContainHTML(
        'John Doe, Roger Wilco assigned to case 23-44462 Bridget Maldonado',
      );
    });
  }, 10000);

  // TODO: Add test to validate error alert after failing to create assignments
  // TODO: Add test to validate attorney names show in table
});
