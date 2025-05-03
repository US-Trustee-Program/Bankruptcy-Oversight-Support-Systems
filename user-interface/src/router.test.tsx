import { CamsRole } from '@common/cams/roles';
import MockData from '@common/cams/test-utilities/mock-data';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

import App from './App';
import LocalStorage from './lib/utils/local-storage';

describe('App Router Tests', () => {
  beforeAll(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
      MockData.getCamsSession({
        user: MockData.getCamsUser({
          roles: [CamsRole.CaseAssignmentManager],
        }),
      }),
    );
  });

  test('should route /search to SearchScreen', async () => {
    render(<App />, { wrapper: BrowserRouter });

    expect(screen.getByTestId('header-search-link')).toBeVisible();

    await userEvent.click(screen.getByTestId('header-search-link'));

    await waitFor(() => {
      expect(document.querySelector('main.search-screen')).toBeInTheDocument();
    });
  });

  test('should render My Cases page when an invalid URL is supplied', async () => {
    const badRoute = '/some/bad/route';

    // use <MemoryRouter> when you want to manually control the history
    render(
      <MemoryRouter initialEntries={[badRoute]}>
        <App />
      </MemoryRouter>,
    );

    // verify navigation to "no match" route
    await waitFor(() => {
      expect(document.querySelector('h1')).toHaveTextContent('My Cases');
    });
  });
});
