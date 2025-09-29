import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TrusteeOtherInfoForm from './TrusteeOtherInfoForm';
import * as UseApi2Module from '@/lib/hooks/UseApi2';
import * as UseGlobalAlertModule from '@/lib/hooks/UseGlobalAlert';
import * as useCamsNavigatorModule from '@/lib/hooks/UseCamsNavigator';
import { Mock } from 'vitest';
import { Trustee } from '@common/cams/trustees';
import { ResponseBody } from '@common/api/response';
import MockData from '@common/cams/test-utilities/mock-data';

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

  let patchTrusteeSpy: Mock<
    (trusteeId: string, trustee: unknown) => Promise<ResponseBody<Trustee>>
  >;

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(UseGlobalAlertModule, 'useGlobalAlert').mockReturnValue(mockGlobalAlert);
    vi.spyOn(useCamsNavigatorModule, 'default').mockReturnValue(mockNavigate);

    // Create a spy on the patchTrustee method of the API
    patchTrusteeSpy = vi.fn().mockResolvedValue({
      data: TRUSTEE,
    });

    // Get the API instance and spy on its patchTrustee method
    const api = UseApi2Module.useApi2();
    vi.spyOn(api, 'patchTrustee').mockImplementation(patchTrusteeSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders the form with initial bank fields', () => {
    render(<TrusteeOtherInfoForm trusteeId={TEST_TRUSTEE_ID} banks={TEST_BANKS} />);

    expect(screen.getByText('Edit Other Information')).toBeInTheDocument();
    expect(screen.getByTestId('trustee-other-info-form')).toBeInTheDocument();

    // Check all initial bank fields are rendered
    TEST_BANKS.forEach((bank, index) => {
      expect(screen.getByTestId(`trustee-banks-${index}`)).toHaveValue(bank);
    });

    // Check that "Remove Bank" button is present for all banks except the first one
    expect(screen.getAllByText('Remove Bank').length).toBe(TEST_BANKS.length - 1);

    // Check that "Add another bank" button is present
    expect(screen.getByText('Add another bank')).toBeInTheDocument();
  });

  test('renders the form with empty bank field when no banks are provided', () => {
    render(<TrusteeOtherInfoForm trusteeId={TEST_TRUSTEE_ID} />);

    expect(screen.getByTestId('trustee-other-info-form')).toBeInTheDocument();
    expect(screen.getByTestId('trustee-banks-0')).toHaveValue('');
    expect(screen.queryByText('Remove Bank')).not.toBeInTheDocument();
  });

  test('adds a bank when "Add another bank" is clicked', async () => {
    render(<TrusteeOtherInfoForm trusteeId={TEST_TRUSTEE_ID} banks={TEST_BANKS} />);

    // Initial number of banks
    expect(screen.getAllByLabelText('Bank')).toHaveLength(TEST_BANKS.length);

    // Click the "Add another bank" button
    await userEvent.click(screen.getByText('Add another bank'));

    // Check a new bank field was added
    expect(screen.getAllByLabelText('Bank')).toHaveLength(TEST_BANKS.length + 1);
    expect(screen.getByTestId(`trustee-banks-${TEST_BANKS.length}`)).toHaveValue('');
  });

  test('removes a bank when "Remove Bank" is clicked', async () => {
    render(<TrusteeOtherInfoForm trusteeId={TEST_TRUSTEE_ID} banks={TEST_BANKS} />);

    // Initial number of banks
    expect(screen.getAllByLabelText('Bank')).toHaveLength(TEST_BANKS.length);

    // Click the first "Remove Bank" button (which removes the second bank)
    await userEvent.click(screen.getAllByText('Remove Bank')[0]);

    // Check that a bank was removed
    expect(screen.getAllByLabelText('Bank')).toHaveLength(TEST_BANKS.length - 1);
  });

  test('updates bank value when input changes', async () => {
    render(<TrusteeOtherInfoForm trusteeId={TEST_TRUSTEE_ID} banks={TEST_BANKS} />);

    const updatedBankName = 'Updated Bank Name';
    const bankInput = screen.getByTestId('trustee-banks-0');

    await userEvent.clear(bankInput);
    await userEvent.type(bankInput, updatedBankName);

    expect(bankInput).toHaveValue(updatedBankName);
  });

  test('submits the form with updated banks', async () => {
    render(<TrusteeOtherInfoForm trusteeId={TEST_TRUSTEE_ID} banks={TEST_BANKS} />);

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
      expect(mockNavigate.navigateTo).toHaveBeenCalledWith(
        `/trustees/${TEST_TRUSTEE_ID}`,
        expect.any(Object),
      );
    });
  });

  test('filters out empty banks when submitting', async () => {
    render(
      <TrusteeOtherInfoForm trusteeId={TEST_TRUSTEE_ID} banks={['Bank One', '', 'Bank Three']} />,
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

    render(<TrusteeOtherInfoForm trusteeId={TEST_TRUSTEE_ID} banks={TEST_BANKS} />);

    // Submit the form
    await userEvent.click(screen.getByTestId('button-submit-button'));

    // Wait for the async operation to complete
    await waitFor(() => {
      expect(mockGlobalAlert.error).toHaveBeenCalledWith(
        `Failed to update trustee banks: ${errorMessage}`,
      );
    });
  });

  test('changes the Save button text when submitting', async () => {
    render(<TrusteeOtherInfoForm trusteeId={TEST_TRUSTEE_ID} banks={TEST_BANKS} />);

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

  test('navigates to trustee page when cancel is clicked', async () => {
    render(<TrusteeOtherInfoForm trusteeId={TEST_TRUSTEE_ID} banks={TEST_BANKS} />);

    // Click the cancel button
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    // Check that navigation occurred to the correct page
    expect(mockNavigate.navigateTo).toHaveBeenCalledWith(`/trustees/${TEST_TRUSTEE_ID}`);
  });
});
