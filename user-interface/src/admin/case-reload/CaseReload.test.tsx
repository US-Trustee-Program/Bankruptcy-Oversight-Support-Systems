import { render, screen, waitFor } from '@testing-library/react';
import { CaseReload } from './CaseReload';
import Api2 from '@/lib/models/api2';

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

      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });

      assertion();
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
