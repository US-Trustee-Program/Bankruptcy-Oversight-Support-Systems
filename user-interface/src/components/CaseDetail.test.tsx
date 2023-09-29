import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '../store/store';
import { CaseAssignment } from './CaseAssignment';
import { CaseDetail } from './CaseDetail';

describe('Case Detail screen tests', () => {
  beforeEach(() => {
    vi.stubEnv('CAMS_PA11Y', 'true');
  });

  beforeAll(() => {
    vi.mock('../models/api', () => {
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
    render(
      <BrowserRouter>
        <Provider store={store}>
          <CaseDetail />
        </Provider>
      </BrowserRouter>,
    );
  });
});
