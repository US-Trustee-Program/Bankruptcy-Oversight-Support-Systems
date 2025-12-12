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

describe('TrusteeOtherInfoForm', () => {
  const TEST_TRUSTEE_ID = 'trustee-123';
  const TEST_BANKS = ['Bank of America', 'Chase', 'Wells Fargo'];
  const TRUSTEE = MockData.getTrustee({ id: TEST_TRUSTEE_ID, banks: TEST_BANKS });

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

  const mockSoftwareOptions = [
    { value: 'Axos', label: 'Axos' },
    { value: 'BlueStylus', label: 'BlueStylus' },
    { value: 'BSS 13Software', label: 'BSS 13Software' },
    { value: 'Epiq', label: 'Epiq' },
    { value: 'Satori', label: 'Satori' },
    { value: 'Stretto', label: 'Stretto' },
    { value: 'TrusteSolutions', label: 'TrusteSolutions' },
    { value: 'Verita Title XI', label: 'Verita Title XI' },
  ];

  let patchTrusteeSpy: Mock<
    (trusteeId: string, trustee: unknown) => Promise<ResponseBody<Trustee>>
  >;
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    userEvent = TestingUtilities.setupUserEvent();
    vi.clearAllMocks();

    vi.spyOn(UseGlobalAlertModule, 'useGlobalAlert').mockReturnValue(mockGlobalAlert);
    vi.spyOn(useCamsNavigatorModule, 'default').mockReturnValue(mockNavigate);

    // Create a spy on the patchTrustee method of the API
    patchTrusteeSpy = vi.fn().mockResolvedValue({
      data: TRUSTEE,
    });

    // Get the API instance and spy on its methods
    const api = Api2;
    vi.spyOn(api, 'patchTrustee').mockImplementation(patchTrusteeSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders the form with initial bank fields', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        banks={TEST_BANKS}
        softwareOptions={mockSoftwareOptions}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('trustee-other-info-form')).toBeInTheDocument();
    });

    // Check all initial bank fields are rendered
    TEST_BANKS.forEach((bank, index) => {
      expect(screen.getByTestId(`trustee-banks-${index}`)).toHaveValue(bank);
    });

    // Check that "Remove Bank" button is present for all banks except the first one
    // Count bank inputs instead of remove buttons since we're using test IDs
    expect(screen.getByTestId('trustee-banks-1')).toBeInTheDocument();
    expect(screen.getByTestId('trustee-banks-2')).toBeInTheDocument();

    // Check that "Add another bank" button is present
    expect(screen.getByTestId('button-add-bank-button')).toBeInTheDocument();
  });

  test('renders the form with empty bank field when no banks are provided', async () => {
    render(
      <TrusteeOtherInfoForm trusteeId={TEST_TRUSTEE_ID} softwareOptions={mockSoftwareOptions} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('trustee-other-info-form')).toBeInTheDocument();
    });
    expect(screen.getByTestId('trustee-banks-0')).toHaveValue('');
    expect(screen.queryByText('Remove Bank')).not.toBeInTheDocument();
  });

  test('adds a bank when "Add another bank" is clicked', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        banks={TEST_BANKS}
        softwareOptions={mockSoftwareOptions}
      />,
    );

    // Initial number of banks - verify they exist
    TEST_BANKS.forEach((_, index) => {
      expect(screen.getByTestId(`trustee-banks-${index}`)).toBeInTheDocument();
    });

    // Click the "Add another bank" button
    await userEvent.click(screen.getByTestId('button-add-bank-button'));

    // Check a new bank field was added
    expect(screen.getByTestId(`trustee-banks-${TEST_BANKS.length}`)).toHaveValue('');
  });

  test('removes a bank when "Remove Bank" is clicked', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        banks={TEST_BANKS}
        softwareOptions={mockSoftwareOptions}
      />,
    );

    // Initial banks should exist
    TEST_BANKS.forEach((_, index) => {
      expect(screen.getByTestId(`trustee-banks-${index}`)).toBeInTheDocument();
    });

    // Click the first "Remove Bank" button (which removes the second bank)
    await userEvent.click(screen.getByTestId('button-remove-bank-1-button'));

    // Check that a bank was removed - the last bank should no longer exist
    expect(screen.queryByTestId(`trustee-banks-${TEST_BANKS.length - 1}`)).not.toBeInTheDocument();
    // But the first bank should still exist
    expect(screen.getByTestId('trustee-banks-0')).toBeInTheDocument();
  });

  test('updates bank value when input changes', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        banks={TEST_BANKS}
        softwareOptions={mockSoftwareOptions}
      />,
    );

    const updatedBankName = 'Updated Bank Name';
    const bankInput = screen.getByTestId('trustee-banks-0');

    await userEvent.clear(bankInput);
    await userEvent.type(bankInput, updatedBankName);

    expect(bankInput).toHaveValue(updatedBankName);
  });

  test('submits the form with updated banks', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        banks={TEST_BANKS}
        softwareOptions={mockSoftwareOptions}
      />,
    );

    // Update first bank name
    const updatedBankName = 'Updated Bank Name';
    const bankInput = screen.getByTestId('trustee-banks-0');
    await userEvent.clear(bankInput);
    await userEvent.type(bankInput, updatedBankName);

    // Submit the form
    await userEvent.click(screen.getByTestId('button-submit-button'));

    // Wait for the async operation to complete
    await waitFor(() => {
      expect(patchTrusteeSpy).toHaveBeenCalledWith(
        TEST_TRUSTEE_ID,
        expect.objectContaining({
          banks: expect.arrayContaining([updatedBankName, TEST_BANKS[1], TEST_BANKS[2]]),
        }),
      );
    });

    // Check that navigation occurred
    await waitFor(() => {
      expect(mockNavigate.navigateTo).toHaveBeenCalledWith(`/trustees/${TEST_TRUSTEE_ID}`);
    });
  });

  test('filters out empty banks when submitting', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        banks={['Bank One', '', 'Bank Three']}
        softwareOptions={mockSoftwareOptions}
      />,
    );

    // Submit the form
    await userEvent.click(screen.getByTestId('button-submit-button'));

    // Wait for the async operation to complete
    await waitFor(() => {
      expect(patchTrusteeSpy).toHaveBeenCalledWith(
        TEST_TRUSTEE_ID,
        expect.objectContaining({
          banks: ['Bank One', 'Bank Three'],
        }),
      );
    });
  });

  test('shows error message when API call fails', async () => {
    const errorMessage = 'API error';
    patchTrusteeSpy.mockRejectedValueOnce(new Error(errorMessage));

    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        banks={TEST_BANKS}
        softwareOptions={mockSoftwareOptions}
      />,
    );

    // Submit the form
    await userEvent.click(screen.getByTestId('button-submit-button'));

    // Wait for the async operation to complete
    await waitFor(() => {
      expect(mockGlobalAlert.error).toHaveBeenCalledWith(
        `Failed to update trustee information: ${errorMessage}`,
      );
    });
  });

  test('changes the Save button text when submitting', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        banks={TEST_BANKS}
        softwareOptions={mockSoftwareOptions}
      />,
    );

    // Submit button should initially show "Save"
    expect(screen.getByTestId('button-submit-button')).toHaveTextContent('Save');

    // Click the submit button
    await userEvent.click(screen.getByTestId('button-submit-button'));

    // Wait for the async operation to complete and verify the API was called
    await waitFor(() => {
      expect(patchTrusteeSpy).toHaveBeenCalled();
    });

    // The button text should return to "Save" after the operation completes
    await waitFor(() => {
      expect(screen.getByTestId('button-submit-button')).toHaveTextContent('Save');
    });
  });

  test('disables submit button during form submission', async () => {
    // Mock the API call to be slow so we can test the disabled state
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
        banks={TEST_BANKS}
        softwareOptions={mockSoftwareOptions}
      />,
    );

    const submitButton = screen.getByTestId('button-submit-button');

    // Submit button should initially be enabled
    expect(submitButton).not.toBeDisabled();
    expect(submitButton).toHaveTextContent('Save');

    // Click the submit button
    await userEvent.click(submitButton);

    // Button should be disabled and show "Saving..." during submission
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveTextContent('Saving…');

    // Wait for the API call to complete
    await waitFor(() => {
      expect(patchTrusteeSpy).toHaveBeenCalled();
    });

    // Button should be re-enabled after submission completes
    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
      expect(submitButton).toHaveTextContent('Save');
    });
  });

  test('navigates to trustee page when cancel is clicked', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        banks={TEST_BANKS}
        softwareOptions={mockSoftwareOptions}
      />,
    );

    // Click the cancel button
    await userEvent.click(screen.getByTestId('button-cancel-button'));

    // Check that navigation occurred to the correct page
    expect(mockNavigate.navigateTo).toHaveBeenCalledWith(`/trustees/${TEST_TRUSTEE_ID}`);
  });

  test('shows error and prevents submission when trusteeId is empty', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId=""
        banks={TEST_BANKS}
        softwareOptions={mockSoftwareOptions}
      />,
    );

    // Submit the form
    await userEvent.click(screen.getByTestId('button-submit-button'));

    // Should show error message and not call API
    expect(mockGlobalAlert.error).toHaveBeenCalledWith(
      'Cannot save trustee information: Trustee ID is missing',
    );
    expect(patchTrusteeSpy).not.toHaveBeenCalled();
  });

  test('shows error and prevents submission when trusteeId is whitespace only', async () => {
    render(
      <TrusteeOtherInfoForm
        trusteeId="   "
        banks={TEST_BANKS}
        softwareOptions={mockSoftwareOptions}
      />,
    );

    // Submit the form
    await userEvent.click(screen.getByTestId('button-submit-button'));

    // Should show error message and not call API
    expect(mockGlobalAlert.error).toHaveBeenCalledWith(
      'Cannot save trustee information: Trustee ID is missing',
    );
    expect(patchTrusteeSpy).not.toHaveBeenCalled();
  });

  test('updates software value when a software option is selected from ComboBox', async () => {
    const initialSoftware = 'Axos';
    const newSoftware = 'Stretto';

    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        software={initialSoftware}
        softwareOptions={mockSoftwareOptions}
      />,
    );

    // Verify initial software selection is displayed in the selection label
    await waitFor(() => {
      const selectionLabel = document.querySelector('.selection-label');
      expect(selectionLabel).toHaveTextContent(initialSoftware);
    });

    // Open the ComboBox dropdown
    const expandButton = document.querySelector('#trustee-software-expand') as HTMLButtonElement;
    await userEvent.click(expandButton);

    // Wait for dropdown to open and find the Stretto option
    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    // Select Stretto option - find it by its data-value attribute
    const strettoOption = document.querySelector('[data-value="Stretto"]') as HTMLLIElement;
    expect(strettoOption).toBeInTheDocument();
    await userEvent.click(strettoOption);

    // Submit the form to verify the software state was updated
    await userEvent.click(screen.getByTestId('button-submit-button'));

    // Verify API was called with the new software value
    await waitFor(() => {
      expect(patchTrusteeSpy).toHaveBeenCalledWith(
        TEST_TRUSTEE_ID,
        expect.objectContaining({
          software: newSoftware,
        }),
      );
    });

    // Check that navigation occurred
    await waitFor(() => {
      expect(mockNavigate.navigateTo).toHaveBeenCalledWith(`/trustees/${TEST_TRUSTEE_ID}`);
    });
  });

  test('clears software value when ComboBox clear button is clicked', async () => {
    const initialSoftware = 'Epiq';

    render(
      <TrusteeOtherInfoForm
        trusteeId={TEST_TRUSTEE_ID}
        software={initialSoftware}
        softwareOptions={mockSoftwareOptions}
      />,
    );

    // Verify initial software selection is displayed in the selection label
    await waitFor(() => {
      const selectionLabel = document.querySelector('.selection-label');
      expect(selectionLabel).toHaveTextContent(initialSoftware);
    });

    const clearButton = document.querySelector('#trustee-software-clear-all') as HTMLButtonElement;
    expect(clearButton).toBeInTheDocument();
    await userEvent.click(clearButton);

    await userEvent.click(screen.getByTestId('button-submit-button'));

    await waitFor(() => {
      expect(patchTrusteeSpy).toHaveBeenCalledWith(
        TEST_TRUSTEE_ID,
        expect.objectContaining({
          software: null,
        }),
      );
    });

    await waitFor(() => {
      expect(mockNavigate.navigateTo).toHaveBeenCalledWith(`/trustees/${TEST_TRUSTEE_ID}`);
    });
  });
});
