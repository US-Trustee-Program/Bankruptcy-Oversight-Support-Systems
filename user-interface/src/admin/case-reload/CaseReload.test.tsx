import { render, screen, waitFor } from '@testing-library/react';
import { CaseReload } from './CaseReload';
import Api2 from '@/lib/models/api2';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { CaseDetail, SyncedCase } from '@common/cams/cases';

const mockCaseDetail: CaseDetail = {
  dxtrId: 'test-dxtr-id',
  caseId: '091-99-88513',
  caseTitle: 'Stroman - Ondricka',
  chapter: '15',
  courtId: '091',
  courtName: 'Western District of New York (Buffalo)',
  courtDivisionName: 'Buffalo',
  courtDivisionCode: '091',
  officeName: 'Manhattan',
  officeCode: '081',
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
  regionName: 'NEW YORK',
  groupDesignator: 'A',
  consolidation: [],
};

const mockSyncedCase: SyncedCase = {
  documentType: 'SYNCED_CASE',
  dxtrId: 'test-dxtr-id',
  caseId: '091-99-88513',
  chapter: '15',
  caseTitle: 'Stroman - Ondricka',
  dateFiled: '2024-01-01',
  updatedOn: '2024-01-15T10:30:00Z',
  updatedBy: { id: 'test-user', name: 'Test User' },
  officeName: 'Manhattan',
  officeCode: '081',
  courtId: '091',
  courtName: 'Western District of New York (Buffalo)',
  courtDivisionCode: '091',
  courtDivisionName: 'Buffalo',
  regionId: '02',
  regionName: 'NEW YORK',
  groupDesignator: 'A',
  debtor: {
    name: 'John Doe',
    address1: '456 Oak Ave',
    cityStateZipCountry: 'Buffalo, NY 14202',
  },
};

const setupCourtsMock = () => {
  return vi.spyOn(Api2, 'getCourts').mockResolvedValue({
    data: [
      {
        courtId: '091',
        courtName: 'Western District of New York',
        courtDivisionName: 'Buffalo',
        courtDivisionCode: '091',
        officeName: 'Manhattan',
        officeCode: '081',
        regionId: '02',
        regionName: 'NEW YORK',
        groupDesignator: 'A',
      },
    ],
  });
};

describe.sequential('CaseReload Component', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('Initial render', () => {
    test('should display header with DXTR in title', async () => {
      setupCourtsMock();
      render(<CaseReload />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      expect(screen.getByText('Reload Case from DXTR')).toBeInTheDocument();
    });

    test('should display form with "Find Case" button', async () => {
      setupCourtsMock();
      render(<CaseReload />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      expect(screen.getByLabelText('Division')).toBeInTheDocument();
      expect(screen.getByLabelText('Case Number')).toBeInTheDocument();
      expect(screen.getByText('Find Case')).toBeInTheDocument();
    });

    test('should have Find Case button disabled initially', async () => {
      setupCourtsMock();
      render(<CaseReload />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const findButton = screen.getByTestId('button-validate-button');
      expect(findButton).toBeDisabled();
    });
  });

  describe('Successful case validation', () => {
    test('should hide form and show "Case Exists" notification', async () => {
      setupCourtsMock();
      const userEvent = TestingUtilities.setupUserEvent();
      vi.spyOn(Api2, 'getCaseDetail').mockResolvedValue({ data: mockCaseDetail });
      vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [mockSyncedCase] });

      render(<CaseReload />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const divisionComboBox = screen.getByRole('combobox', { name: /division/i });
      await userEvent.click(divisionComboBox);

      await waitFor(() => {
        expect(screen.getByText(/Buffalo/)).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText(/Buffalo/));

      const caseNumberInput = screen.getByLabelText('Case Number');
      await userEvent.type(caseNumberInput, '99-88513');

      const findButton = screen.getByTestId('button-validate-button');
      await userEvent.click(findButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert-validated-case-alert')).toBeInTheDocument();
      });

      expect(screen.getByText('Case Exists')).toBeInTheDocument();
      expect(screen.queryByLabelText('Division')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Case Number')).not.toBeInTheDocument();
      expect(screen.queryByText('Find Case')).not.toBeInTheDocument();
    });

    test('should display all case details', async () => {
      setupCourtsMock();
      const userEvent = TestingUtilities.setupUserEvent();
      vi.spyOn(Api2, 'getCaseDetail').mockResolvedValue({ data: mockCaseDetail });
      vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [mockSyncedCase] });

      render(<CaseReload />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const divisionComboBox = screen.getByRole('combobox', { name: /division/i });
      await userEvent.click(divisionComboBox);

      await waitFor(() => {
        expect(screen.getByText(/Buffalo/)).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText(/Buffalo/));

      const caseNumberInput = screen.getByLabelText('Case Number');
      await userEvent.type(caseNumberInput, '99-88513');

      const findButton = screen.getByTestId('button-validate-button');
      await userEvent.click(findButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert-validated-case-alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/Division:/)).toBeInTheDocument();
      expect(screen.getByText(/Western District of New York \(Buffalo\)/)).toBeInTheDocument();
      expect(screen.getByText(/Case Number:/)).toBeInTheDocument();
      expect(screen.getByText(/99-88513/)).toBeInTheDocument();
      expect(screen.getByText(/Case Title:/)).toBeInTheDocument();
      expect(screen.getByText(/Stroman - Ondricka/)).toBeInTheDocument();
      expect(screen.getByText(/Sync Status:/)).toBeInTheDocument();
    });

    test('should show "Reload Case" and "Reset" buttons', async () => {
      setupCourtsMock();
      const userEvent = TestingUtilities.setupUserEvent();
      vi.spyOn(Api2, 'getCaseDetail').mockResolvedValue({ data: mockCaseDetail });
      vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [mockSyncedCase] });

      render(<CaseReload />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const divisionComboBox = screen.getByRole('combobox', { name: /division/i });
      await userEvent.click(divisionComboBox);

      await waitFor(() => {
        expect(screen.getByText(/Buffalo/)).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText(/Buffalo/));

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

      const resetButton = screen.getByTestId('button-reset-button');
      expect(resetButton).toBeInTheDocument();
      expect(resetButton).toHaveTextContent('Reset');
    });
  });

  describe('Reset functionality', () => {
    test('should reset form and clear validation when Reset is clicked', async () => {
      setupCourtsMock();
      const userEvent = TestingUtilities.setupUserEvent();
      vi.spyOn(Api2, 'getCaseDetail').mockResolvedValue({ data: mockCaseDetail });
      vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [mockSyncedCase] });

      render(<CaseReload />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const divisionComboBox = screen.getByRole('combobox', { name: /division/i });
      await userEvent.click(divisionComboBox);

      await waitFor(() => {
        expect(screen.getByText(/Buffalo/)).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText(/Buffalo/));

      const caseNumberInput = screen.getByLabelText('Case Number');
      await userEvent.type(caseNumberInput, '99-88513');

      const findButton = screen.getByTestId('button-validate-button');
      await userEvent.click(findButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert-validated-case-alert')).toBeInTheDocument();
      });

      const resetButton = screen.getByTestId('button-reset-button');
      await userEvent.click(resetButton);

      await waitFor(() => {
        expect(screen.queryByTestId('alert-validated-case-alert')).not.toBeInTheDocument();
      });

      expect(screen.getByLabelText('Division')).toBeInTheDocument();
      expect(screen.getByLabelText('Case Number')).toBeInTheDocument();
      expect(screen.getByText('Find Case')).toBeInTheDocument();
    });
  });

  describe('Case number display', () => {
    test('should display case number without division prefix duplication', async () => {
      setupCourtsMock();
      const userEvent = TestingUtilities.setupUserEvent();
      vi.spyOn(Api2, 'getCaseDetail').mockResolvedValue({ data: mockCaseDetail });
      vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [mockSyncedCase] });

      render(<CaseReload />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const divisionComboBox = screen.getByRole('combobox', { name: /division/i });
      await userEvent.click(divisionComboBox);

      await waitFor(() => {
        expect(screen.getByText(/Buffalo/)).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText(/Buffalo/));

      const caseNumberInput = screen.getByLabelText('Case Number');
      await userEvent.type(caseNumberInput, '99-88513');

      const findButton = screen.getByTestId('button-validate-button');
      await userEvent.click(findButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert-validated-case-alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/Case Number:/)).toBeInTheDocument();
      expect(screen.getByText(/99-88513/)).toBeInTheDocument();
      expect(screen.queryByText(/091-99-88513/)).not.toBeInTheDocument();
    });
  });

  describe('Form attributes', () => {
    test('should disable autocomplete on case number input', async () => {
      setupCourtsMock();
      render(<CaseReload />);

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      const caseNumberInput = screen.getByLabelText('Case Number');
      expect(caseNumberInput).toHaveAttribute('autocomplete', 'off');
    });
  });
});
