import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from './App';
import { vi } from 'vitest';

describe('App Router Tests', () => {
  beforeAll(async () => {
    vi.stubEnv('CAMS_PA11Y', 'true');
  });

  test('should route /case-assignment to CaseAssignment', async () => {
    render(<App />, { wrapper: BrowserRouter });

    await userEvent.click(screen.getByTestId('header-cases-link'));

    expect(screen.getByTestId('case-list-heading')).toBeInTheDocument();
  });

  test('should render Not Found 404 page when an invalid URL is supplied', async () => {
    const badRoute = '/some/bad/route';

    // use <MemoryRouter> when you want to manually control the history
    render(
      <MemoryRouter initialEntries={[badRoute]}>
        <App />
      </MemoryRouter>,
    );

    // verify navigation to "no match" route
    await waitFor(() => {
      expect(screen.getByText(/404 - Not Found/i)).toBeInTheDocument();
    });
  });
});
