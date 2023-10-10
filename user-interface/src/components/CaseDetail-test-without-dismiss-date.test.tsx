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

const sleep = (milliseconds: number) =>
  new Promise((callback) => setTimeout(callback, milliseconds));

const caseId = '101-23-54321';
const brianWilsonName = 'Brian Wilson';
const carlWilsonName = 'Carl Wilson';
describe('Case Detail screen tests', () => {
  beforeEach(() => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    vi.mock('../models/chapter15-mock.api.cases.ts', () => {
      return {
        default: {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          get: async (path: string, options: object) => {
            await sleep(1000);
            return {
              message: '',
              count: 1,
              body: {
                caseDetails: {
                  caseId: caseId,
                  caseTitle: 'The Beach Boys',
                  dateFiled: '01-04-1962',
                  closedDate: '01-08-1963',
                  assignments: [brianWilsonName, carlWilsonName],
                },
              },
            };
          },
        },
      };
    });
  });

  test('should not display case dismissed date if not supplied in api response', async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
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
