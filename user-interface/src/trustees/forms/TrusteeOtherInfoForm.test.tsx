import { render, screen, waitFor } from '@testing-library/react';
import TrusteeOtherInfoForm from './TrusteeOtherInfoForm';
import Api2 from '@/lib/models/api2';
import * as UseGlobalAlertModule from '@/lib/hooks/UseGlobalAlert';
import * as useCamsNavigatorModule from '@/lib/hooks/UseCamsNavigator';
import { Mock } from 'vitest';
import { Trustee } from '@common/cams/trustees';
import { ResponseBody } from '@common/api/response';
import MockData from '@common/cams/test-utilities/mock-data';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import { BankruptcySoftwareProfile } from '@common/cams/bankruptcy-software';

describe('TrusteeOtherInfoForm', () => {
  const TEST_TRUSTEE_ID = 'trustee-123';

  const mockSoftwareProfiles: BankruptcySoftwareProfile[] = [
    {
      id: 'sw-axos',
      documentType: 'BANKRUPTCY_SOFTWARE',
      name: 'Axos',
      status: 'active',
      updatedOn: '2024-01-01T00:00:00.000Z',
      updatedBy: { id: 'user-1', name: 'User One' },
      associatedBanks: [
        { bankId: 'bank-fifth-third', bankName: 'Fifth Third Bank', status: 'active' },
        { bankId: 'bank-key', bankName: 'Key Bank', status: 'active' },
        { bankId: 'bank-inactive', bankName: 'Inactive Bank', status: 'inactive' },
      ],
    },
    {
      id: 'sw-stretto',
      documentType: 'BANKRUPTCY_SOFTWARE',
      name: 'Stretto',
      status: 'active',
      updatedOn: '2024-01-01T00:00:00.000Z',
      updatedBy: { id: 'user-1', name: 'User One' },
      associatedBanks: [{ bankId: 'bank-chase', bankName: 'Chase', status: 'active' }],
    },
  ];

  const mockSoftwareOptions = [
    { value: 'sw-axos', label: 'Axos' },
    { value: 'sw-stretto', label: 'Stretto' },
  ];

  const mockGlobalAlert = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
  };

  const mockNavigate = {
    navigateTo: vi.fn(),
    redirectTo: vi.fn(),
  };

  let patchTrusteeSpy: Mock<
    (trusteeId: string, trustee: unknown) => Promise<ResponseBody<Trustee>>
  >;
  let userEvent: CamsUserEvent;

  const TRUSTEE = MockData.getTrustee({ id: TEST_TRUSTEE_ID, banks: ['bank-fifth-third'] });

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
    vi.clearAllMocks();

    vi.spyOn(UseGlobalAlertModule, 'useGlobalAlert').mockReturnValue(mockGlobalAlert);
    vi.spyOn(useCamsNavigatorModule, 'default').mockReturnValue(mockNavigate);

    patchTrusteeSpy = vi.fn().mockResolvedValue({
      data: TRUSTEE,
    });

    vi.spyOn(Api2, 'patchTrustee').mockImplementation(patchTrusteeSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders disabled bank ComboBox when no software is selected', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        softwareOptions={mockSoftwareOptions}
        softwareProfiles={mockSoftwareProfiles}
      />,
    );

    await waitFor(() => {
      const bankInput = document.querySelector(
        '#trustee-banks-0-combo-box-input',
      ) as HTMLInputElement;
      expect(bankInput).toBeInTheDocument();
      expect(bankInput).toBeDisabled();
    });
    expect(screen.getByTestId('button-add-bank-button')).toBeDisabled();
    expect(screen.getByTestId('button-submit-button')).toBeDisabled();
  });

  test('enables bank ComboBox and add button when software is selected', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        softwareId="sw-axos"
        softwareOptions={mockSoftwareOptions}
        softwareProfiles={mockSoftwareProfiles}
      />,
    );

    await waitFor(() => {
      const bankInput = document.querySelector(
        '#trustee-banks-0-combo-box-input',
      ) as HTMLInputElement;
      expect(bankInput).not.toBeDisabled();
    });
    expect(screen.getByTestId('button-add-bank-button')).not.toBeDisabled();
  });

  test('pre-populates bank selections from props', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        softwareId="sw-axos"
        banks={['bank-fifth-third']}
        softwareOptions={mockSoftwareOptions}
        softwareProfiles={mockSoftwareProfiles}
      />,
    );

    await waitFor(() => {
      const input = document.querySelector('#trustee-banks-0-combo-box-input') as HTMLInputElement;
      expect(input).toHaveValue('Fifth Third Bank');
    });
  });

  test('adds a bank dropdown when "Add another bank" is clicked', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        softwareId="sw-axos"
        softwareOptions={mockSoftwareOptions}
        softwareProfiles={mockSoftwareProfiles}
      />,
    );

    await userEvent.click(screen.getByTestId('button-add-bank-button'));

    expect(document.querySelector('#trustee-banks-0-combo-box-input')).toBeInTheDocument();
    expect(document.querySelector('#trustee-banks-1-combo-box-input')).toBeInTheDocument();
  });

  test('filters out cleared banks on submit', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        softwareId="sw-axos"
        banks={['bank-fifth-third', 'bank-key']}
        softwareOptions={mockSoftwareOptions}
        softwareProfiles={mockSoftwareProfiles}
      />,
    );

    const clearButton = document.querySelector('#trustee-banks-1-clear-all') as HTMLButtonElement;
    await userEvent.click(clearButton);

    await userEvent.click(screen.getByTestId('button-submit-button'));

    await waitFor(() => {
      expect(patchTrusteeSpy).toHaveBeenCalledWith(
        TEST_TRUSTEE_ID,
        expect.objectContaining({
          banks: ['bank-fifth-third'],
          softwareId: 'sw-axos',
        }),
      );
    });
  });

  test('clears banks when software vendor changes', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        softwareId="sw-axos"
        banks={['bank-fifth-third']}
        softwareOptions={mockSoftwareOptions}
        softwareProfiles={mockSoftwareProfiles}
      />,
    );

    // Verify bank is initially populated
    await waitFor(() => {
      const input = document.querySelector('#trustee-banks-0-combo-box-input') as HTMLInputElement;
      expect(input).toHaveValue('Fifth Third Bank');
    });

    // Change software selection
    const expandButton = document.querySelector('#trustee-software-expand') as HTMLButtonElement;
    await userEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    const strettoOption = document.querySelector('[data-value="sw-stretto"]') as HTMLLIElement;
    await userEvent.click(strettoOption);

    // Banks should be cleared - the old bank input should be gone
    await waitFor(() => {
      const bankInput = document.querySelector(
        '#trustee-banks-0-combo-box-input',
      ) as HTMLInputElement;
      // After software change, banks are cleared but one empty row shows
      expect(bankInput?.value || '').toBe('');
    });
  });

  test('submits bank IDs to the API', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        softwareId="sw-axos"
        banks={['bank-fifth-third', 'bank-key']}
        softwareOptions={mockSoftwareOptions}
        softwareProfiles={mockSoftwareProfiles}
      />,
    );

    await userEvent.click(screen.getByTestId('button-submit-button'));

    await waitFor(() => {
      expect(patchTrusteeSpy).toHaveBeenCalledWith(
        TEST_TRUSTEE_ID,
        expect.objectContaining({
          banks: ['bank-fifth-third', 'bank-key'],
          softwareId: 'sw-axos',
        }),
      );
    });
  });

  test('disables save when software is selected but no bank is chosen', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        softwareId="sw-axos"
        softwareOptions={mockSoftwareOptions}
        softwareProfiles={mockSoftwareProfiles}
      />,
    );

    expect(screen.getByTestId('button-submit-button')).toBeDisabled();
  });

  test('shows error message when API call fails', async () => {
    const errorMessage = 'API error';
    patchTrusteeSpy.mockRejectedValueOnce(new Error(errorMessage));

    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        softwareId="sw-axos"
        banks={['bank-fifth-third']}
        softwareOptions={mockSoftwareOptions}
        softwareProfiles={mockSoftwareProfiles}
      />,
    );

    await userEvent.click(screen.getByTestId('button-submit-button'));

    await waitFor(() => {
      expect(mockGlobalAlert.error).toHaveBeenCalledWith(
        `Failed to update trustee information: ${errorMessage}`,
      );
    });
  });

  test('navigates to trustee page when cancel is clicked', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        softwareOptions={mockSoftwareOptions}
        softwareProfiles={mockSoftwareProfiles}
      />,
    );

    await userEvent.click(screen.getByTestId('button-cancel-button'));

    expect(mockNavigate.navigateTo).toHaveBeenCalledWith(`/trustees/${TEST_TRUSTEE_ID}`);
  });

  test('disables submit button during form submission', async () => {
    patchTrusteeSpy.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({ data: TRUSTEE });
          }, 100);
        }),
    );

    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        softwareId="sw-axos"
        banks={['bank-fifth-third']}
        softwareOptions={mockSoftwareOptions}
        softwareProfiles={mockSoftwareProfiles}
      />,
    );

    const submitButton = screen.getByTestId('button-submit-button');
    expect(submitButton).not.toBeDisabled();

    await userEvent.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent('Saving…');

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });
  });

  test.each([[''], ['   ']])(
    'shows error and prevents submission when trusteeId is %j',
    async (trusteeId) => {
      render(
        <TrusteeOtherInfoForm
          trusteeId={trusteeId}
          softwareId="sw-axos"
          banks={['bank-fifth-third']}
          softwareOptions={mockSoftwareOptions}
          softwareProfiles={mockSoftwareProfiles}
        />,
      );

      await userEvent.click(screen.getByTestId('button-submit-button'));

      expect(mockGlobalAlert.error).toHaveBeenCalledWith(
        'Cannot save trustee information: Trustee ID is missing',
      );
      expect(patchTrusteeSpy).not.toHaveBeenCalled();
    },
  );

  test('filters inactive banks from dropdown options', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        softwareId="sw-axos"
        softwareOptions={mockSoftwareOptions}
        softwareProfiles={mockSoftwareProfiles}
      />,
    );

    // Open the bank ComboBox dropdown
    const expandButton = document.querySelector('#trustee-banks-0-expand') as HTMLButtonElement;
    await userEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // Active banks should be visible
    expect(document.querySelector('[data-value="bank-fifth-third"]')).toBeInTheDocument();
    expect(document.querySelector('[data-value="bank-key"]')).toBeInTheDocument();
    // Inactive bank should NOT be visible
    expect(document.querySelector('[data-value="bank-inactive"]')).not.toBeInTheDocument();
  });

  test('disables bank and save when software is cleared', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        softwareId="sw-axos"
        banks={['bank-fifth-third']}
        softwareOptions={mockSoftwareOptions}
        softwareProfiles={mockSoftwareProfiles}
      />,
    );

    const clearButton = document.querySelector('#trustee-software-clear-all') as HTMLButtonElement;
    expect(clearButton).toBeInTheDocument();
    await userEvent.click(clearButton);

    await waitFor(() => {
      const bankInput = document.querySelector(
        '#trustee-banks-0-combo-box-input',
      ) as HTMLInputElement;
      expect(bankInput).toBeDisabled();
    });
    expect(screen.getByTestId('button-submit-button')).toBeDisabled();
  });
});
