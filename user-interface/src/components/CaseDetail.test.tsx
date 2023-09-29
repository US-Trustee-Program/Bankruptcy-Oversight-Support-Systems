import { vi } from 'vitest';
import { render, waitFor, screen, waitForElementToBeRemoved } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '../store/store';
import { CaseDetail } from './CaseDetail';

const sleep = (milliseconds: number) =>
  new Promise((callback) => setTimeout(callback, milliseconds));

const caseId = '101-23-12345';
const brianWilsonName = 'Brian Wilson';
const carlWilsonName = 'Carl Wilson';
const trialAttorneyRole = 'Trial Attorney';
describe('Case Detail screen tests', () => {
  beforeEach(() => {
    vi.stubEnv('CAMS_PA11Y', 'true');
  });

  beforeAll(() => {
    vi.mock('../models/chapter15-mock.api.cases.ts', () => {
      return {
        default: {
          get: async () => {
            await sleep(1000);
            return {
              message: '',
              count: 1,
              body: {
                caseDetails: {
                  caseId: caseId,
                  caseTitle: 'The Beach Boys',
                  dateFiled: '01-04-1962',
                  dateClosed: '01-08-1963',
                  assignedStaff: [
                    {
                      name: brianWilsonName,
                      type: trialAttorneyRole,
                    },
                    {
                      name: carlWilsonName,
                      type: trialAttorneyRole,
                    },
                  ],
                },
              },
            };
          },
        },
      };
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
        expect(caseNumber?.innerHTML).toEqual(caseId);

        const dateFiled = screen.getByTestId('case-detail-filed-date');
        const dateClosed = screen.getByTestId('case-detail-closed-date');
        expect(dateFiled.innerHTML).toEqual('01-04-1962');
        expect(dateClosed.innerHTML).toEqual('01-08-1963');

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
        expect(assigneeMap.get(`${brianWilsonName}:`)).toEqual(trialAttorneyRole);
        expect(assigneeMap.get(`${carlWilsonName}:`)).toEqual(trialAttorneyRole);
      },
      { timeout: 5000 },
    );
  }, 20000);
});
