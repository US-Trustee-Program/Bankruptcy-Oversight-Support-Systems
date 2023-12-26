import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { CaseAssignment } from './CaseAssignmentScreen';
import Chapter15MockApi from '../lib/models/chapter15-mock.api.cases';
import { ResponseData } from '../lib/type-declarations/api';
import { vi } from 'vitest';
import * as FeatureFlags from '../lib/hooks/UseFeatureFlags';

// for UX, it might be good to put a time limit on the api call to return results, and display an appropriate screen message to user.
// for UX, do we want to limit number of results to display on screen (pagination discussion to table for now)

/*
 * Used in tests that are commented out below
const sleep = (milliseconds: number) =>
  new Promise((callback) => setTimeout(callback, milliseconds));
*/

describe('CaseAssignment Component Tests', () => {
  beforeEach(() => {
    vi.stubEnv('CAMS_PA11Y', 'true');
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
          <CaseAssignment />
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
        <CaseAssignment />
      </BrowserRouter>,
    );

    await waitFor(
      async () => {
        const subtitle = screen.getByTestId('case-list-subtitle');
        expect(subtitle.textContent).toBe('Region 2 (Manhattan Office)');
      },
      { timeout: 3000 },
    );
  });

  test('/cases should not contain any Unassigned Cases table when all cases are assigned', async () => {
    vi.spyOn(Chapter15MockApi, 'list').mockImplementation(
      (_path: string): Promise<ResponseData> => {
        return Promise.resolve({
          message: 'not found',
          count: 0,
          body: {
            caseList: [
              {
                caseId: '081-23-44463',
                caseTitle: 'Flo Esterly and Neas Van Sampson',
                dateFiled: '2023-05-04',
                assignments: ['Sara', 'Bob'],
              },
              {
                caseId: '081-23-44462',
                caseTitle: 'Bridget Maldonado',
                dateFiled: '2023-04-14',
                assignments: ['Frank', 'Sue'],
              },
              {
                caseId: '081-23-44461',
                caseTitle: 'Talia Torres and Tylor Stevenson',
                dateFiled: '2023-04-04',
                assignments: ['Joe', 'Sam'],
              },
            ],
          },
        });
      },
    );

    render(
      <BrowserRouter>
        <CaseAssignment />
      </BrowserRouter>,
    );

    await waitFor(() => {
      screen.getAllByTestId('assigned-table-body');
    });
    let unassignedTableBody;
    try {
      unassignedTableBody = screen.getAllByTestId('unassigned-table-body');
      expect(true).toBeFalsy();
    } catch (err) {
      expect(unassignedTableBody).toBeUndefined();
      console.log('unassigned table does not exist');
    }
  });

  test('/cases should contain table displaying assigned cases when all cases are assigned', async () => {
    vi.spyOn(Chapter15MockApi, 'list').mockImplementation(
      (_path: string): Promise<ResponseData> => {
        return Promise.resolve({
          message: 'not found',
          count: 0,
          body: {
            caseList: [
              {
                caseId: '081-23-44463',
                caseTitle: 'Flo Esterly and Neas Van Sampson',
                dateFiled: '2023-05-04',
                assignments: ['Sara', 'Bob'],
              },
              {
                caseId: '081-23-44462',
                caseTitle: 'Bridget Maldonado',
                dateFiled: '2023-04-14',
                assignments: ['Frank', 'Sue'],
              },
              {
                caseId: '081-23-44461',
                caseTitle: 'Talia Torres and Tylor Stevenson',
                dateFiled: '2023-04-04',
                assignments: ['Joe', 'Sam'],
              },
            ],
          },
        });
      },
    );

    render(
      <BrowserRouter>
        <CaseAssignment />
      </BrowserRouter>,
    );

    await waitFor(() => {
      const tableBody = screen.getAllByTestId('assigned-table-body');
      const data = tableBody[0].querySelectorAll('tr');
      expect(data).toHaveLength(3);
    });
  });

  test('/cases should contain table displaying 1 unassigned case and table with 2 assigned cases when 2 cases are assigned and 1 is not', async () => {
    vi.spyOn(Chapter15MockApi, 'list').mockImplementation(
      (_path: string): Promise<ResponseData> => {
        return Promise.resolve({
          message: '',
          count: 4,
          body: {
            caseList: [
              {
                caseId: '081-23-44463',
                chapter: '12',
                caseTitle: 'Flo Esterly and Neas Van Sampson',
                dateFiled: '2023-05-04',
                assignments: ['Sara', 'Bob'],
              },
              {
                caseId: '081-23-44462',
                chapter: '15',
                caseTitle: 'Bridget Maldonado',
                dateFiled: '2023-04-14',
                assignments: [],
              },
              {
                caseId: '081-23-44461',
                chapter: '15',
                caseTitle: 'Talia Torres and Tylor Stevenson',
                dateFiled: '2023-04-04',
                assignments: ['Joe', 'Sam'],
              },
              {
                caseId: '081-23-44460',
                chapter: '12',
                caseTitle: 'Foo Bar',
                dateFiled: '2023-04-14',
                assignments: [],
              },
              {
                caseId: '081-23-44455',
                chapter: '11',
                caseTitle: 'Foo Bar',
                dateFiled: '2023-04-14',
                assignments: [],
              },
            ],
          },
        });
      },
    );

    render(
      <BrowserRouter>
        <CaseAssignment />
      </BrowserRouter>,
    );

    await waitFor(() => {
      const unassignedTableBody = screen.getAllByTestId('unassigned-table-body');
      const unassignedData = unassignedTableBody[0].querySelectorAll('tr');
      expect(unassignedData).toHaveLength(3);
      const assignedTableBody = screen.getAllByTestId('assigned-table-body');
      const assignedData = assignedTableBody[0].querySelectorAll('tr');
      expect(assignedData).toHaveLength(2);
    });
  });

  /**
   * We need to add a test that starts with 1 unassigned case and assignes attorneys to it.
   * The attorneys table should then contain the 1 case and the unassigned cases table
   * should go away.
   */

  // if api.list returns more than 0 results, then all results will be displayed in table body content
  /*
  test('/cases should contain a valid list of cases in the table when api.list returns more than 0 results', async () => {
    vi.spyOn(Chapter15MockApi, 'list')
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
          <CaseAssignment />
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
  */

  /***
   * This test seems to pass most of the time when running it locally, but fails sometimes.
   * We spent a lot of time on this test, but until we can get it to pass consistentely,
   * we are commenting it out for now.
  test('should display success alert after creating assignments', async () => {
    vi.spyOn(Chapter15MockApi, 'list')
      .mockImplementation((_path: string): Promise<ResponseData> => {
        return Promise.resolve({
          message: '',
          count: 8,
          body: {
            caseList: [
              {
                caseId: '081-23-44463',
                caseTitle: 'Flo Esterly and Neas Van Sampson',
                dateFiled: '2023-05-04',
              },
              {
                caseId: '081-23-44462',
                caseTitle: 'Bridget Maldonado',
                dateFiled: '2023-04-14',
              },
              {
                caseId: '081-23-44461',
                caseTitle: 'Talia Torres and Tylor Stevenson',
                dateFiled: '2023-04-04',
              },
              {
                caseId: '081-23-44460',
                caseTitle: 'Asia Hodges',
                dateFiled: '2023-03-01',
              },
              {
                caseId: '081-23-44459',
                caseTitle: 'Marilyn Lawson',
                dateFiled: '2023-02-14',
              },
              {
                caseId: '081-23-44458',
                caseTitle: 'April Pierce and Leah Pierce',
                dateFiled: '2023-02-04',
              },
              {
                caseId: '081-23-44457',
                caseTitle: 'Corinne Gordon',
                dateFiled: '2023-01-14',
              },
              {
                caseId: '081-23-44456',
                caseTitle: 'Marilyn Lang and Rudy Bryant',
                dateFiled: '2023-01-04',
              },
            ],
          },
        });
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

    render(
      <BrowserRouter>
          <CaseAssignment />
      </BrowserRouter>,
    );

    let passedExpects = 0;

    let assignButton: HTMLButtonElement;
    await waitFor(
      async () => {
        assignButton = screen.getByTestId('toggle-modal-button-1');
        expect(assignButton).toBeInTheDocument();
      },
      { timeout: 1000 },
    ).then(() => {
      passedExpects++;
      act(() => {
        fireEvent.click(assignButton);
      });
    });
    await sleep(100);

    await waitFor(
      () => {
        expect(screen.getByTestId('checkbox-1-checkbox')).toBeInTheDocument();
      },
      { timeout: 100 },
    ).then(() => {
      passedExpects++;
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
    await sleep(100);

    const alert = screen.getByTestId('alert');
    const alertMessage = screen.getByTestId('alert-message');

    await waitFor(
      () => {
        expect(alert).toHaveClass('usa-alert__visible');
      },
      { timeout: 6000 },
    ).then(() => {
      expect(alert).toHaveAttribute('role', 'status');
      expect(alert).toHaveClass('usa-alert--success');
      expect(alertMessage).toContainHTML(
        'John Doe, Roger Wilco assigned to case 23-44462 Bridget Maldonado',
      );
      passedExpects += 4;
    });

    expect(passedExpects).toEqual(6);
  }, 100000);
  ***/

  /***
  //TODO: Add test to validate error alert after failing to create assignments
  //TODO: Need to come back and fix test for CAMS-87
  // This is passing locally but not in the pipeline and appears to be some sort
  // of timeout issue. We worked a long time on this test. If we can get it to pass
  // consistently then we should re-enable it.
  test(`should display selected attorneys' names after creating assignments`, async () => {
    vi.spyOn(Chapter15MockApi, 'list')
      .mockImplementation((_path: string): Promise<ResponseData> => {
        return Promise.resolve({
          message: '',
          count: 8,
          body: {
            caseList: [
              {
                caseId: '081-23-44463',
                caseTitle: 'Flo Esterly and Neas Van Sampson',
                dateFiled: '2023-05-04',
              },
              {
                caseId: '081-23-44462',
                caseTitle: 'Bridget Maldonado',
                dateFiled: '2023-04-14',
              },
              {
                caseId: '081-23-44461',
                caseTitle: 'Talia Torres and Tylor Stevenson',
                dateFiled: '2023-04-04',
              },
              {
                caseId: '081-23-44460',
                caseTitle: 'Asia Hodges',
                dateFiled: '2023-03-01',
              },
              {
                caseId: '081-23-44459',
                caseTitle: 'Marilyn Lawson',
                dateFiled: '2023-02-14',
              },
              {
                caseId: '081-23-44458',
                caseTitle: 'April Pierce and Leah Pierce',
                dateFiled: '2023-02-04',
              },
              {
                caseId: '081-23-44457',
                caseTitle: 'Corinne Gordon',
                dateFiled: '2023-01-14',
              },
              {
                caseId: '081-23-44456',
                caseTitle: 'Marilyn Lang and Rudy Bryant',
                dateFiled: '2023-01-04',
              },
            ],
          },
        });
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

    render(
      <BrowserRouter>
          <CaseAssignment />
      </BrowserRouter>,
    );

    let passedExpects = 0;

    const loadingMsg = screen.getByTestId('loading-indicator');
    await waitFor(() => {
      expect(loadingMsg).not.toBeInTheDocument();
    });
    let assignButton: HTMLButtonElement;
    await waitFor(
      async () => {
        assignButton = screen.getByTestId('toggle-modal-button-1');
        expect(assignButton).toBeInTheDocument();
      },
      { timeout: 1000 },
    ).then(() => {
      passedExpects++;
      act(() => {
        fireEvent.click(assignButton);
      });
    });
    await sleep(100);

    await waitFor(
      () => {
        expect(screen.getByTestId('checkbox-1-checkbox')).toBeInTheDocument();
      },
      { timeout: 100 },
    ).then(() => {
      passedExpects++;
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

    const attorneyList = await screen.getByTestId('attorney-list-1');

    await waitFor(() => {
      expect(attorneyList).toHaveTextContent('John Doe');
      expect(attorneyList).toHaveTextContent('Roger Wilco');
    }).then(() => {
      passedExpects += 2;
    });

    expect(passedExpects).toEqual(4);
  }, 10000);
  ***/

  describe('Feature flag chapter-twelve-enabled', () => {
    test('should display appropriate text when true', async () => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({ 'chapter-twelve-enabled': true });

      render(
        <BrowserRouter>
          <CaseAssignment />
        </BrowserRouter>,
      );

      await waitFor(() => {
        const screenTitle = screen.getByTestId('case-list-heading');
        expect(screenTitle).toBeInTheDocument();
        expect(screenTitle.innerHTML).toEqual('Bankruptcy Cases');
      });
    });

    test('should display appropriate text when false', async () => {
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({ 'chapter-twelve-enabled': false });

      render(
        <BrowserRouter>
          <CaseAssignment />
        </BrowserRouter>,
      );

      await waitFor(() => {
        const screenTitle = screen.getByTestId('case-list-heading');
        expect(screenTitle).toBeInTheDocument();
        expect(screenTitle.innerHTML).toEqual('Bankruptcy Cases');
      });
    });

    test('should display correct chapter number', async () => {
      render(
        <BrowserRouter>
          <CaseAssignment />
        </BrowserRouter>,
      );

      await waitFor(() => {
        const tableHeaders = screen.getAllByTestId('chapter-table-header');
        for (const e of tableHeaders) {
          expect(e).toBeInTheDocument();
          expect(e.innerHTML).toEqual('Chapter');
        }

        const chapterElevenTableData = screen.getByTestId('081-23-44455-chapter');
        expect(chapterElevenTableData).toBeInTheDocument();
        expect(chapterElevenTableData.innerHTML).toContain('11');

        const chapterTwelveTableData = screen.getByTestId('081-23-44460-chapter');
        expect(chapterTwelveTableData).toBeInTheDocument();
        expect(chapterTwelveTableData.innerHTML).toContain('12');

        const chapterFifteenTableData = screen.getByTestId('081-23-44461-chapter');
        expect(chapterFifteenTableData).toBeInTheDocument();
        expect(chapterFifteenTableData.innerHTML).toContain('15');
      });
    });
  });
});
