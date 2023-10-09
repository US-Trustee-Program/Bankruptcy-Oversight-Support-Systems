import { describe, vi } from 'vitest';
import {
  render,
  waitFor,
  screen,
  waitForElementToBeRemoved,
  queryByTestId,
} from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '../store/store';
import { CaseDetail } from './CaseDetail';
import { getCaseNumber } from '../utils/formatCaseNumber';

const sleep = (milliseconds: number) =>
  new Promise((callback) => setTimeout(callback, milliseconds));

const caseId = '101-23-12345';
const caseIdTwo = '101-23-54321';
const brianWilsonName = 'Brian Wilson';
const carlWilsonName = 'Carl Wilson';
const trialAttorneyRole = 'Trial Attorney';
describe('Case Detail screen tests', () => {
  beforeEach(() => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    vi.mock('../models/chapter15-mock.api.cases.ts', () => {
      return {
        default: {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          get: async (path: string, options: object) => {
            await sleep(1000);
            if (caseId === '101-23-12345') {
              return {
                message: '',
                count: 1,
                body: {
                  caseDetails: {
                    caseId: caseId,
                    caseTitle: 'The Beach Boys',
                    dateFiled: '01-04-1962',
                    closedDate: '01-08-1963',
                    dismissedDate: '01-08-1964',
                    assignments: [brianWilsonName, carlWilsonName],
                  },
                },
              };
            } else {
              return {
                message: '',
                count: 1,
                body: {
                  caseDetails: {
                    caseId: caseIdTwo,
                    caseTitle: 'The Beach Boys',
                    dateFiled: '01-04-1962',
                    closedDate: '01-08-1963',
                    assignments: [brianWilsonName, carlWilsonName],
                  },
                },
              };
            }
          },
        },
      };
    });
  });

  test('should display case title, case number, dates, and assignees for the case', async () => {
    vi.mock('react-router-dom', async () => {
      const actual = (await vi.importActual('react-router-dom')) as object;
      return {
        ...actual,
        useParams: () => {
          return {
            caseId,
          };
        },
      };
    });

    render(
      <BrowserRouter>
        <Provider store={store}>
          <CaseDetail />
        </Provider>
      </BrowserRouter>,
    );
    await waitForElementToBeRemoved(screen.getByTestId('loading-indicator')).then(() => {
      sleep(100);
    });

    await waitFor(
      async () => {
        const title = screen.getByTestId('case-detail-heading');
        expect(title.innerHTML).toEqual('The Beach Boys');
        const caseNumber = document.querySelector('.case-number');
        expect(caseNumber?.innerHTML).toEqual(getCaseNumber(caseId));

        const dateFiled = screen.getByTestId('case-detail-filed-date');
        expect(dateFiled.innerHTML).toEqual('01-04-1962');

        const closedDate = screen.getByTestId('case-detail-closed-date');
        expect(closedDate.innerHTML).toEqual('01-08-1963');

        const dismissedDate = screen.getByTestId('case-detail-dismissed-date');
        expect(dismissedDate.innerHTML).toEqual('01-08-1964');

        const assigneeMap = new Map<string, string>();
        const assigneeElements = document.querySelectorAll(
          '.assigned-staff-list .individual-assignee',
        );
        assigneeElements?.forEach((assignee) => {
          const name = assignee.querySelector('.assignee-name')?.innerHTML;
          const role = assignee.querySelector('.assignee-role')?.innerHTML;
          if (name && role) {
            assigneeMap.set(name, role);
          }
        });
        expect(assigneeMap.get(`${brianWilsonName}`)).toEqual(trialAttorneyRole);
        expect(assigneeMap.get(`${carlWilsonName}`)).toEqual(trialAttorneyRole);
      },
      { timeout: 5000 },
    );

    vi.unstubAllEnvs();
    vi.clearAllMocks();
  }, 20000);

  test('should display case title, case number, dates, and assignees for the case', async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    vi.mock('react-router-dom', async () => {
      const actual = (await vi.importActual('react-router-dom')) as object;
      return {
        ...actual,
        useParams: () => {
          return {
            caseIdTwo,
          };
        },
      };
    });

    render(
      <BrowserRouter>
        <Provider store={store}>
          <CaseDetail />
        </Provider>
      </BrowserRouter>,
    );
    await waitForElementToBeRemoved(screen.getByTestId('loading-indicator')).then(() => {
      sleep(100);
    });

    await waitFor(
      async () => {
        // const title = screen.getByTestId('[data-testid="case-detail-heading"]');
        // expect(title).not.toBeUn

        // const dismissedDate = document.querySelector('[data-testid="case-detail-dismissed-date"]');
        // expect(dismissedDate.innerHTML).toEqual('01-08-1964');
        expect(queryByTestId(document.body, 'case-detail-dismissed-date')).not.toBeInTheDocument();
      },
      { timeout: 5000 },
    );

    vi.unstubAllEnvs();
    vi.clearAllMocks();
  }, 20000);
});
