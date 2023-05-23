import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from './App';

describe('App Router Tests', () => {
  it('should load screen with login form when route is /', async () => {
    const { container } = render(<App />, { wrapper: BrowserRouter });

    // verify page content for default route
    const forms = container.getElementsByClassName('login-form');
    expect(forms.length).toBe(1);
  });

  it('should route /cases to CaseList', async () => {
    render(<App />, { wrapper: BrowserRouter });

    await act(async () => {
      // verify page content for expected route after navigating
      await userEvent.click(screen.getByTestId('main-nav-cases-link'));
    });

    expect(screen.getByText('Case List')).toBeInTheDocument();
  });

  it('should render Not Found 404 page when an invalid URL is supplied', () => {
    const badRoute = '/some/bad/route';

    // use <MemoryRouter> when you want to manually control the history
    render(
      <MemoryRouter initialEntries={[badRoute]}>
        <App />
      </MemoryRouter>,
    );

    // verify navigation to "no match" route
    expect(screen.getByText(/404 - Not Found/i)).toBeInTheDocument();
  });
});
