import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaseReload } from './CaseReload';
import Api2 from '@/lib/models/api2';
import MockData from '@common/cams/test-utilities/mock-data';

const DIVISION_CODE = '091';
const CASE_NUMBER = '23-12345';

const mockCourt = {
  courtId: DIVISION_CODE,
  courtName: 'Western District of New York',
  courtDivisionName: 'Buffalo',
  courtDivisionCode: DIVISION_CODE,
  officeName: 'Manhattan',
  officeCode: '081',
  regionId: '02',
  regionName: 'NEW YORK',
  groupDesignator: 'A',
};

const setupCourtsMock = () => {
  return vi.spyOn(Api2, 'getCourts').mockResolvedValue({ data: [mockCourt] });
};

async function waitForLoaded() {
  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });
}

async function selectDivision() {
  await userEvent.click(screen.getByTestId('button-division-select-expand'));
  await userEvent.click(screen.getByTestId('division-select-option-item-0'));
}

function enterCaseNumber(value: string) {
  const input = screen.getByLabelText('Case Number');
  fireEvent.change(input, { target: { value } });
}

describe.sequential('CaseReload Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('Initial render', () => {
    test.each([
      {
        description: 'header with DXTR in title',
        assertion: () => {
          expect(screen.getByText('Reload Case from DXTR')).toBeInTheDocument();
        },
      },
      {
        description: 'form with "Find Case" button',
        assertion: () => {
          expect(screen.getByLabelText('Division')).toBeInTheDocument();
          expect(screen.getByLabelText('Case Number')).toBeInTheDocument();
          expect(screen.getByText('Find Case')).toBeInTheDocument();
        },
      },
      {
        description: 'Find Case button disabled initially',
        assertion: () => {
          const findButton = screen.getByTestId('button-validate-button');
          expect(findButton).toBeDisabled();
        },
      },
    ])('should display $description', async ({ assertion }) => {
      setupCourtsMock();
      render(<CaseReload />);

      await waitForLoaded();

      assertion();
    });
  });

  describe('Form attributes', () => {
    test('should disable autocomplete on case number input', async () => {
      setupCourtsMock();
      render(<CaseReload />);

      await waitForLoaded();

      const caseNumberInput = screen.getByLabelText('Case Number');
      expect(caseNumberInput).toHaveAttribute('autocomplete', 'off');
    });
  });

  describe('Form validation', () => {
    test('Find Case button remains disabled with only case number entered', async () => {
      setupCourtsMock();
      render(<CaseReload />);
      await waitForLoaded();

      enterCaseNumber(CASE_NUMBER);

      expect(screen.getByTestId('button-validate-button')).toBeDisabled();
    });

    test('Find Case button remains disabled with only division selected', async () => {
      setupCourtsMock();
      render(<CaseReload />);
      await waitForLoaded();

      await selectDivision();

      expect(screen.getByTestId('button-validate-button')).toBeDisabled();
    });

    test('Find Case button becomes enabled when division and valid case number are both entered', async () => {
      setupCourtsMock();
      render(<CaseReload />);
      await waitForLoaded();

      await selectDivision();
      enterCaseNumber(CASE_NUMBER);

      expect(screen.getByTestId('button-validate-button')).not.toBeDisabled();
    });

    test('Find Case button remains disabled with invalid case number format', async () => {
      setupCourtsMock();
      render(<CaseReload />);
      await waitForLoaded();

      await selectDivision();
      enterCaseNumber('invalid');

      expect(screen.getByTestId('button-validate-button')).toBeDisabled();
    });
  });

  describe('Case validation flow', () => {
    test('shows validated case and action buttons on successful validation', async () => {
      setupCourtsMock();
      const caseDetail = MockData.getCaseDetail({
        override: { caseId: `${DIVISION_CODE}-${CASE_NUMBER}` },
      });
      vi.spyOn(Api2, 'getCaseDetail').mockResolvedValue({ data: caseDetail });
      vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [] });

      render(<CaseReload />);
      await waitForLoaded();

      await selectDivision();
      enterCaseNumber(CASE_NUMBER);
      await userEvent.click(screen.getByTestId('button-validate-button'));

      await waitFor(() => {
        expect(screen.getByText('Case Exists')).toBeInTheDocument();
      });

      expect(screen.getByTestId('button-reload-button')).toBeInTheDocument();
      expect(screen.getByTestId('button-reset-button')).toBeInTheDocument();
    });

    test('shows search form results when cosmosCase is returned', async () => {
      setupCourtsMock();
      const caseDetail = MockData.getCaseDetail({
        override: { caseId: `${DIVISION_CODE}-${CASE_NUMBER}` },
      });
      const syncedCase = MockData.getSyncedCase({
        override: { caseId: `${DIVISION_CODE}-${CASE_NUMBER}` },
      });
      vi.spyOn(Api2, 'getCaseDetail').mockResolvedValue({ data: caseDetail });
      vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [syncedCase] });

      render(<CaseReload />);
      await waitForLoaded();

      await selectDivision();
      enterCaseNumber(CASE_NUMBER);
      await userEvent.click(screen.getByTestId('button-validate-button'));

      await waitFor(() => {
        expect(screen.getByText(/Last synced:/)).toBeInTheDocument();
      });
    });

    test('shows "Case Not Found" error when case does not exist', async () => {
      setupCourtsMock();
      vi.spyOn(Api2, 'getCaseDetail').mockRejectedValue(
        new Error('404 Error - /cases/091-23-12345 - Not Found'),
      );

      render(<CaseReload />);
      await waitForLoaded();

      await selectDivision();
      enterCaseNumber(CASE_NUMBER);
      await userEvent.click(screen.getByTestId('button-validate-button'));

      await waitFor(() => {
        expect(screen.getByTestId('validation-error-container')).toBeInTheDocument();
      });
      expect(screen.getByText('Case Not Found')).toBeInTheDocument();
    });

    test('shows generic validation error on API failure', async () => {
      setupCourtsMock();
      vi.spyOn(Api2, 'getCaseDetail').mockRejectedValue(
        new Error('500 Error - /cases/091-23-12345 - Internal Server Error'),
      );

      render(<CaseReload />);
      await waitForLoaded();

      await selectDivision();
      enterCaseNumber(CASE_NUMBER);
      await userEvent.click(screen.getByTestId('button-validate-button'));

      await waitFor(() => {
        expect(screen.getByTestId('validation-error-container')).toBeInTheDocument();
      });
    });
  });

  describe('Case reload flow', () => {
    async function renderAndValidateCase() {
      setupCourtsMock();
      const caseDetail = MockData.getCaseDetail({
        override: { caseId: `${DIVISION_CODE}-${CASE_NUMBER}` },
      });
      vi.spyOn(Api2, 'getCaseDetail').mockResolvedValue({ data: caseDetail });
      vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [] });

      render(<CaseReload />);
      await waitForLoaded();

      await selectDivision();
      enterCaseNumber(CASE_NUMBER);
      await userEvent.click(screen.getByTestId('button-validate-button'));

      await waitFor(() => {
        expect(screen.getByTestId('button-reload-button')).toBeInTheDocument();
      });
    }

    test('starts polling on successful reload request', async () => {
      await renderAndValidateCase();
      vi.spyOn(Api2, 'postCaseReload').mockResolvedValue(undefined as never);
      vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [] });

      await userEvent.click(screen.getByTestId('button-reload-button'));

      await waitFor(() => {
        expect(Api2.postCaseReload).toHaveBeenCalledWith(`${DIVISION_CODE}-${CASE_NUMBER}`);
      });
    });

    test('shows reload error when reload API call fails', async () => {
      await renderAndValidateCase();
      vi.spyOn(Api2, 'postCaseReload').mockRejectedValue(new Error('Network error'));

      await userEvent.click(screen.getByTestId('button-reload-button'));

      await waitFor(() => {
        expect(screen.getByTestId('reload-error-container')).toBeInTheDocument();
      });
    });
  });

  describe('Reset flow', () => {
    test('resets form to initial state when Reset is clicked', async () => {
      setupCourtsMock();
      const caseDetail = MockData.getCaseDetail({
        override: { caseId: `${DIVISION_CODE}-${CASE_NUMBER}` },
      });
      vi.spyOn(Api2, 'getCaseDetail').mockResolvedValue({ data: caseDetail });
      vi.spyOn(Api2, 'searchCases').mockResolvedValue({ data: [] });

      render(<CaseReload />);
      await waitForLoaded();

      await selectDivision();
      enterCaseNumber(CASE_NUMBER);
      await userEvent.click(screen.getByTestId('button-validate-button'));

      await waitFor(() => {
        expect(screen.getByText('Case Exists')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('button-reset-button'));

      await waitFor(() => {
        expect(screen.getByTestId('button-validate-button')).toBeInTheDocument();
      });
      expect(screen.queryByText('Case Exists')).not.toBeInTheDocument();
    });
  });
});
