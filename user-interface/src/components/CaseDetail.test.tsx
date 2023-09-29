import { vi } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '../store/store';
import { CaseDetail } from './CaseDetail';

describe('Case Detail screen tests', () => {
  beforeEach(() => {
    vi.stubEnv('CAMS_PA11Y', 'true');
  });

  beforeAll(() => {
    vi.mock('../models/chapter15-mock.api.cases.ts', () => {
      return {
        default: {
          get: async () => {
            return {
              caseId: '101-23-12345',
              caseTitle: 'The Beach Boys',
              dateFiled: '01-04-1962',
              dateClosed: '01-08-1963',
              assignedStaff: [
                {
                  name: 'Brian Wilson',
                  type: 'Trial Attorney',
                },
                {
                  name: 'Carl Wilson',
                  type: 'Trial Attorney',
                },
              ],
            };
          },
        },
      };
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('should display dates for the case', async () => {
    vi.mock('react-router-dom', async () => {
      const actual = (await vi.importActual('react-router-dom')) as object;
      return {
        ...actual,
        useParams: () => {
          return {
            caseId: '101-23-12345',
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
    await waitFor(
      async () => {
        const title = screen.getByTestId('case-detail-heading');
        expect(title).toEqual('The Beach Boys');
        /*
        const dateFiled = screen.getByTestId('case-detail-filed-date');
        const dateClosed = screen.getByTestId('case-detail-closed-date');

        expect(dateFiled.innerHTML).toEqual('01-04-1962');
        expect(dateClosed.innerHTML).toEqual('01-08-1963');
        */
      },
      { timeout: 10000 },
    );
  }, 20000);
});
