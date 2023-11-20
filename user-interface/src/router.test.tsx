import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from './App';
import * as HTTP from './lib/utils/http.adapter';
import { vi } from 'vitest';

const mockCaseList = {
  success: true,
  message: '',
  count: 0,
  body: {
    caseList: [],
  },
};

const mockAttorneysList = {
  success: true,
  message: '',
  count: 0,
  body: {
    attorneyList: [],
  },
};

describe('App Router Tests', () => {
  test('should route /case-assignment to CaseAssignment', async () => {
    vi.spyOn(HTTP, 'httpGet').mockImplementation(
      (data: { url: string; headers?: object }): Promise<Response> => {
        if (data.url.includes('/attorneys')) {
          return Promise.resolve({
            json: () => mockAttorneysList,
            ok: true,
            status: 200,
          } as unknown as Response);
        } else {
          return Promise.resolve({
            json: () => mockCaseList,
            ok: true,
            status: 200,
          } as unknown as Response);
        }
      },
    );

    render(<App />, { wrapper: BrowserRouter });

    await act(async () => {
      // verify page content for expected route after navigating
      await userEvent.click(screen.getByTestId('main-nav-case-assignment-link'));
    });

    expect(screen.getByTestId('case-list-heading')).toBeInTheDocument();
  });
  /**/

  test('should render Not Found 404 page when an invalid URL is supplied', () => {
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
