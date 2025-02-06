import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthenticationRoutes } from '@/login/AuthenticationRoutes';
import App from '@/App';
import userEvent from '@testing-library/user-event';

describe('Staff assignment', () => {
  beforeEach(() => {
    vi.stubEnv('CAMS_LOGIN_PROVIDER', 'none');
    vi.stubEnv('CAMS_DISABLE_LOCAL_CACHE', 'true');
    vi.stubEnv('CAMS_PA11Y', 'true');
    vi.stubEnv('CAMS_APPLICATIONINSIGHTS_CONNECTION_STRING', '');
  });

  test('should show a sorted attorney list in the assignment modal', async function () {
    render(
      <React.StrictMode>
        <BrowserRouter>
          <AuthenticationRoutes>
            <App />
          </AuthenticationRoutes>
        </BrowserRouter>
      </React.StrictMode>,
    );

    let staffAssignmentTab;
    await waitFor(() => {
      staffAssignmentTab = screen.queryByText('Staff Assignment');
      expect(staffAssignmentTab).toBeInTheDocument();
    });
    await userEvent.click(staffAssignmentTab!);

    let firstCaseAssignmentButton;
    await waitFor(async () => {
      // TODO: Can we use a better selector than test ID since it is closer to an implementation detail than a descriptive label?
      firstCaseAssignmentButton = screen.queryByTestId('open-modal-button-0');
      expect(firstCaseAssignmentButton).toBeInTheDocument();
    });
    await userEvent.click(firstCaseAssignmentButton!);

    await waitFor(async () => {
      // TODO: Can we use a better selector than test ID since it is closer to an implementation detail than a descriptive label?
      const attorneyListTbody = screen.queryByTestId('case-load-table-body');
      expect(attorneyListTbody).toBeInTheDocument();
      const attorneyNames = [...attorneyListTbody!.childNodes].map((row) => row.textContent);
      expect(attorneyNames.length).toBeGreaterThan(1);
      const sortedAttorneyNames = attorneyNames.sort((a, b) => {
        if (!a) return -1;
        if (!b) return -1;
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
      });
      attorneyNames.forEach((original, idx) => {
        expect(original).toBeTruthy();
        expect(original).toEqual(sortedAttorneyNames[idx]);
      });
    });
  });
});
