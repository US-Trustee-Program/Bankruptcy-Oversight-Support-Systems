import { render, screen, waitFor } from '@testing-library/react';
import { CaseReload } from './CaseReload';
import Api2 from '@/lib/models/api2';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { CaseDetail, SyncedCase } from '@common/cams/cases';

const mockCaseDetail: CaseDetail = {
  caseId: '091-99-88513',
  caseTitle: 'Stroman - Ondricka',
  chapter: '15',
  courtId: '091',
  courtName: 'Western District of New York (Buffalo)',
  courtDivisionName: 'Buffalo',
  caseLoad: 'default',
  dateFiled: '2024-01-01',
  debtorAttorney: {
    name: 'Test Attorney',
    address1: '123 Main St',
    cityStateZipCountry: 'Buffalo, NY 14202',
  },
  debtor: {
    name: 'John Doe',
    address1: '456 Oak Ave',
    cityStateZipCountry: 'Buffalo, NY 14202',
  },
  regionId: '02',
  groupDesignator: 'A',
};

const mockSyncedCase: SyncedCase = {
  caseId: '091-99-88513',
  chapter: '15',
  caseTitle: 'Stroman - Ondricka',
  dateFiled: '2024-01-01',
  updatedOn: '2024-01-15T10:30:00Z',
};

describe('CaseReload Component - UX and Presentation Tests', () => {
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    userEvent = TestingUtilities.setupUserEvent();

    vi.spyOn(Api2, 'getCourts').mockResolvedValue({
      data: [
        {
          courtId: '091',
          courtName: 'Western District of New York',
          courtDivisionName: 'Buffalo',
          abbreviation: 'NYWB',
          courtDivisionCode: '091',
          regionId: '02',
          groupDesignator: 'A',
        },
      ],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderComponent() {
    return render(<CaseReload />);
  }

  describe('Initial render', () => {
    test('should display header without DXTR subheading', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Reload Case')).toBeInTheDocument();
      expect(screen.queryByText(/DXTR/)).not.toBeInTheDocument();
    });

    test('should display form with "Find Case" button', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      expect(screen.getByLabelText('Division')).toBeInTheDocument();
      expect(screen.getByLabelText('Case Number')).toBeInTheDocument();
      expect(screen.getByText('Find Case')).toBeInTheDocument();
      expect(screen.queryByText('Validate Case')).not.toBeInTheDocument();
    });

    test('should have Find Case button disabled initially', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const findButton = screen.getByTestId('button-validate-button');
      expect(findButton).toBeDisabled();
    });
  });

  describe('404 Error - Case Not Found', () => {
    test('should display "Case Not Found" title with no message for 404', async () => {
      vi.spyOn(Api2, 'getCaseDetail').mockRejectedValue(
        new Error('404 Error - /cases/091-99-98535 - Case summary not found'),
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const divisionComboBox = screen.getByRole('combobox', { name: /division/i });
      await userEvent.click(divisionComboBox);

      await waitFor(() => {
        const buffaloOption = screen.getByText(/Buffalo/);
        expect(buffaloOption).toBeInTheDocument();
      });

      const buffaloOption = screen.getByText(/Buffalo/);
      await userEvent.click(buffaloOption);

      const caseNumberInput = screen.getByLabelText('Case Number');
      await userEvent.type(caseNumberInput, '99-98535');

      const findButton = screen.getByTestId('button-validate-button');
      await userEvent.click(findButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert-validation-error-alert')).toBeInTheDocument();
      });

      // Should show only the title, no subtitle/message
      const alert = screen.getByTestId('alert-validation-error-alert');
      expect(alert).toHaveTextContent('Case Not Found');
      expect(alert).not.toHaveTextContent('091-99-98535');
      expect(alert).not.toHaveTextContent('Case summary not found');
    });

    test('should keep form visible after 404 error', async () => {
      vi.spyOn(Api2, 'getCaseDetail').mockRejectedValue(
        new Error('404 Error - /cases/091-99-98535 - Case summary not found'),
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const divisionComboBox = screen.getByRole('combobox', { name: /division/i });
      await userEvent.click(divisionComboBox);

      await waitFor(() => {
        const buffaloOption = screen.getByText(/Buffalo/);
        expect(buffaloOption).toBeInTheDocument();
      });

      const buffaloOption = screen.getByText(/Buffalo/);
      await userEvent.click(buffaloOption);

      const caseNumberInput = screen.getByLabelText('Case Number');
      await userEvent.type(caseNumberInput, '99-98535');

      const findButton = screen.getByTestId('button-validate-button');
      await userEvent.click(findButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert-validation-error-alert')).toBeInTheDocument();
      });

      // Form should still be visible
      expect(screen.getByLabelText('Division')).toBeInTheDocument();
      expect(screen.getByLabelText('Case Number')).toBeInTheDocument();
      expect(screen.getByTestId('button-validate-button')).toBeInTheDocument();
    });
  });

  describe('500 Error - Server Error', () => {
    test('should display "Error" title with detailed message for 500', async () => {
      vi.spyOn(Api2, 'getCaseDetail').mockRejectedValue(
        new Error('500 Error - /cases/091-99-88513 - Database connection timeout'),
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const divisionComboBox = screen.getByRole('combobox', { name: /division/i });
      await userEvent.click(divisionComboBox);

      await waitFor(() => {
        const buffaloOption = screen.getByText(/Buffalo/);
        expect(buffaloOption).toBeInTheDocument();
      });

      const buffaloOption = screen.getByText(/Buffalo/);
      await userEvent.click(buffaloOption);

      const caseNumberInput = screen.getByLabelText('Case Number');
      await userEvent.type(caseNumberInput, '99-88513');

      const findButton = screen.getByTestId('button-validate-button');
      await userEvent.click(findButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert-validation-error-alert')).toBeInTheDocument();
      });

      // Should show "Error" as title and detailed message as subtitle
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Database connection timeout')).toBeInTheDocument();
    });

    test('should display fallback error message when no details available', async () => {
      vi.spyOn(Api2, 'getCaseDetail').mockRejectedValue(new Error('Network error'));

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const divisionComboBox = screen.getByRole('combobox', { name: /division/i });
      await userEvent.click(divisionComboBox);

      await waitFor(() => {
        const buffaloOption = screen.getByText(/Buffalo/);
        expect(buffaloOption).toBeInTheDocument();
      });

      const buffaloOption = screen.getByText(/Buffalo/);
      await userEvent.click(buffaloOption);

      const caseNumberInput = screen.getByLabelText('Case Number');
      await userEvent.type(caseNumberInput, '99-88513');

      const findButton = screen.getByTestId('button-validate-button');
      await userEvent.click(findButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert-validation-error-alert')).toBeInTheDocument();
      });

      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(
        screen.getByText('Error encountered attempting to verify the case ID'),
      ).toBeInTheDocument();
    });
  });

  describe('Successful case validation', () => {
    test('should hide form and show "Case Exists" notification', async () => {
      vi.spyOn(Api2, 'getCaseDetail').mockResolvedValue({ data: mockCaseDetail });
      vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [mockSyncedCase] });

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const divisionComboBox = screen.getByRole('combobox', { name: /division/i });
      await userEvent.click(divisionComboBox);

      await waitFor(() => {
        const buffaloOption = screen.getByText(/Buffalo/);
        expect(buffaloOption).toBeInTheDocument();
      });

      const buffaloOption = screen.getByText(/Buffalo/);
      await userEvent.click(buffaloOption);

      const caseNumberInput = screen.getByLabelText('Case Number');
      await userEvent.type(caseNumberInput, '99-88513');

      const findButton = screen.getByTestId('button-validate-button');
      await userEvent.click(findButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert-validated-case-alert')).toBeInTheDocument();
      });

      // Should show "Case Exists" title
      expect(screen.getByText('Case Exists')).toBeInTheDocument();

      // Form should be hidden
      expect(screen.queryByLabelText('Division')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Case Number')).not.toBeInTheDocument();
      expect(screen.queryByText('Find Case')).not.toBeInTheDocument();
    });

    test('should display all case details with reduced spacing', async () => {
      vi.spyOn(Api2, 'getCaseDetail').mockResolvedValue({ data: mockCaseDetail });
      vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [mockSyncedCase] });

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const divisionComboBox = screen.getByRole('combobox', { name: /division/i });
      await userEvent.click(divisionComboBox);

      await waitFor(() => {
        const buffaloOption = screen.getByText(/Buffalo/);
        expect(buffaloOption).toBeInTheDocument();
      });

      const buffaloOption = screen.getByText(/Buffalo/);
      await userEvent.click(buffaloOption);

      const caseNumberInput = screen.getByLabelText('Case Number');
      await userEvent.type(caseNumberInput, '99-88513');

      const findButton = screen.getByTestId('button-validate-button');
      await userEvent.click(findButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert-validated-case-alert')).toBeInTheDocument();
      });

      // Check all case details are displayed
      expect(screen.getByText(/Division:/)).toBeInTheDocument();
      expect(screen.getByText(/Western District of New York \(Buffalo\)/)).toBeInTheDocument();
      expect(screen.getByText(/Case Number:/)).toBeInTheDocument();
      expect(screen.getByText(/99-88513/)).toBeInTheDocument();
      expect(screen.getByText(/Case Title:/)).toBeInTheDocument();
      expect(screen.getByText(/Stroman - Ondricka/)).toBeInTheDocument();
      expect(screen.getByText(/Sync Status:/)).toBeInTheDocument();
    });

    test('should show "Reload Case" and "Reset" buttons', async () => {
      vi.spyOn(Api2, 'getCaseDetail').mockResolvedValue({ data: mockCaseDetail });
      vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [mockSyncedCase] });

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const divisionComboBox = screen.getByRole('combobox', { name: /division/i });
      await userEvent.click(divisionComboBox);

      await waitFor(() => {
        const buffaloOption = screen.getByText(/Buffalo/);
        expect(buffaloOption).toBeInTheDocument();
      });

      const buffaloOption = screen.getByText(/Buffalo/);
      await userEvent.click(buffaloOption);

      const caseNumberInput = screen.getByLabelText('Case Number');
      await userEvent.type(caseNumberInput, '99-88513');

      const findButton = screen.getByTestId('button-validate-button');
      await userEvent.click(findButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert-validated-case-alert')).toBeInTheDocument();
      });

      const reloadButton = screen.getByTestId('button-reload-button');
      expect(reloadButton).toBeInTheDocument();
      expect(reloadButton).toHaveTextContent('Reload Case');
      expect(screen.queryByText('Queue Case Reload')).not.toBeInTheDocument();

      const resetButton = screen.getByTestId('button-reset-button');
      expect(resetButton).toBeInTheDocument();
      expect(resetButton).toHaveTextContent('Reset');
    });
  });

  describe('Reset functionality', () => {
    test('should reset form and clear validation when Reset is clicked', async () => {
      vi.spyOn(Api2, 'getCaseDetail').mockResolvedValue({ data: mockCaseDetail });
      vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [mockSyncedCase] });

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const divisionComboBox = screen.getByRole('combobox', { name: /division/i });
      await userEvent.click(divisionComboBox);

      await waitFor(() => {
        const buffaloOption = screen.getByText(/Buffalo/);
        expect(buffaloOption).toBeInTheDocument();
      });

      const buffaloOption = screen.getByText(/Buffalo/);
      await userEvent.click(buffaloOption);

      const caseNumberInput = screen.getByLabelText('Case Number');
      await userEvent.type(caseNumberInput, '99-88513');

      const findButton = screen.getByTestId('button-validate-button');
      await userEvent.click(findButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert-validated-case-alert')).toBeInTheDocument();
      });

      // Click Reset button
      const resetButton = screen.getByTestId('button-reset-button');
      await userEvent.click(resetButton);

      await waitFor(() => {
        expect(screen.queryByTestId('validated-case-alert')).not.toBeInTheDocument();
      });

      // Form should be visible again
      expect(screen.getByLabelText('Division')).toBeInTheDocument();
      expect(screen.getByLabelText('Case Number')).toBeInTheDocument();
      expect(screen.getByText('Find Case')).toBeInTheDocument();
    });
  });

  describe('Inline alert styling', () => {
    test('should display alerts as inline (not fixed position)', async () => {
      vi.spyOn(Api2, 'getCaseDetail').mockRejectedValue(
        new Error('404 Error - /cases/091-99-98535 - Case summary not found'),
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const divisionComboBox = screen.getByRole('combobox', { name: /division/i });
      await userEvent.click(divisionComboBox);

      await waitFor(() => {
        const buffaloOption = screen.getByText(/Buffalo/);
        expect(buffaloOption).toBeInTheDocument();
      });

      const buffaloOption = screen.getByText(/Buffalo/);
      await userEvent.click(buffaloOption);

      const caseNumberInput = screen.getByLabelText('Case Number');
      await userEvent.type(caseNumberInput, '99-98535');

      const findButton = screen.getByTestId('button-validate-button');
      await userEvent.click(findButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert-validation-error-alert')).toBeInTheDocument();
      });

      const alertContainer = screen
        .getByTestId('alert-validation-error-alert')
        .closest('.usa-alert-container');
      expect(alertContainer).toHaveClass('inline-alert');
    });
  });
});
