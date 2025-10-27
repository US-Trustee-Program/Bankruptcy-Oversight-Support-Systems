import { render, screen, waitFor } from '@testing-library/react';

import { BankruptcySoftware } from './BankruptcySoftware';
import Api2 from '@/lib/models/api2';
import testingUtilities, { CamsUserEvent, TestingUtilities } from '@/lib/testing/testing-utilities';
import { BankruptcySoftwareList, BankruptcySoftwareListItem } from '@common/cams/lists';
import { Creatable } from '@common/cams/creatable';

function createMockBankruptcySoftwareItem(
  id: string,
  software: string,
): BankruptcySoftwareListItem {
  return {
    _id: id,
    list: 'bankruptcy-software',
    key: software.toLowerCase().replace(/\s+/g, '-'),
    value: software,
  };
}

function createMockBankruptcySoftwareList(): BankruptcySoftwareList {
  return [
    createMockBankruptcySoftwareItem('1', 'NextChapter'),
    createMockBankruptcySoftwareItem('2', 'Best Case'),
    createMockBankruptcySoftwareItem('3', 'CINcompass'),
  ];
}

describe('BankruptcySoftware Component Tests', () => {
  let mockSoftwareList: BankruptcySoftwareList;
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');

    mockSoftwareList = createMockBankruptcySoftwareList();
    userEvent = TestingUtilities.setupUserEvent();

    vi.spyOn(Api2, 'getBankruptcySoftwareList').mockResolvedValue({
      data: mockSoftwareList,
    });
    vi.spyOn(Api2, 'postBankruptcySoftware').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderComponent() {
    return render(<BankruptcySoftware />);
  }

  test('should render component with loading state initially', async () => {
    // No await on renderComponent to catch the component in loading state
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  test('should load and display bankruptcy software list', async () => {
    renderComponent();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Verify heading and form sections are displayed
    expect(screen.getByText('Current Software Options')).toBeInTheDocument();
    expect(screen.getByLabelText('Add New Software')).toBeInTheDocument();

    // Verify software list is displayed
    const softwareList = screen.getByTestId('software-list');
    expect(softwareList).toBeInTheDocument();

    // Verify each software item is displayed
    mockSoftwareList.forEach((software) => {
      expect(screen.getByTestId(`software-item-${software._id}`)).toBeInTheDocument();
      expect(screen.getByText(software.value)).toBeInTheDocument();
    });
  });

  test('should display empty state when no software options exist', async () => {
    // Mock empty list
    vi.spyOn(Api2, 'getBankruptcySoftwareList').mockResolvedValue({
      data: [],
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    expect(
      screen.getByText('No bankruptcy software options are currently configured.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('software-list')).not.toBeInTheDocument();
  });

  test('should have save button disabled when input is empty', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: 'Add Software' });
    expect(saveButton).toBeDisabled();
  });

  test('should enable save button when input has value', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const input = screen.getByLabelText('Add New Software');
    const saveButton = screen.getByRole('button', { name: 'Add Software' });

    expect(saveButton).toBeDisabled();

    await userEvent.type(input, 'New Software');

    expect(saveButton).not.toBeDisabled();
  });

  test('should handle input changes correctly', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const input = screen.getByLabelText('Add New Software') as HTMLInputElement;

    await userEvent.type(input, 'Test Software');

    expect(input.value).toBe('Test Software');
  });

  test.skip('should show warning when attempting to save with empty name', async () => {
    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();

    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const input = screen.getByLabelText('Add New Software');
    const saveButton = screen.getByRole('button', { name: 'Add Software' });

    await userEvent.clear(input);
    await userEvent.click(saveButton);

    expect(globalAlertSpy.warning).toHaveBeenCalledWith('Software name cannot be empty.');
  });

  test('should save new software successfully', async () => {
    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();
    const postSpy = vi.spyOn(Api2, 'postBankruptcySoftware').mockResolvedValue();
    const getBankruptcySoftwareListSpy = vi.spyOn(Api2, 'getBankruptcySoftwareList');

    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const input = screen.getByLabelText('Add New Software');
    const saveButton = screen.getByRole('button', { name: 'Add Software' });

    await userEvent.type(input, 'New Bankruptcy Software');
    await userEvent.click(saveButton);

    const payload: Creatable<BankruptcySoftwareListItem> = {
      list: 'bankruptcy-software' as const,
      key: 'New Bankruptcy Software',
      value: 'New Bankruptcy Software',
    };

    expect(postSpy).toHaveBeenCalledWith(payload);
    expect(globalAlertSpy.success).toHaveBeenCalledWith('Bankruptcy software added successfully.');
    expect(getBankruptcySoftwareListSpy).toHaveBeenCalledTimes(2); // Initial load + reload after save
  });

  test('should clear input field after successful save', async () => {
    testingUtilities.spyOnGlobalAlert();
    vi.spyOn(Api2, 'postBankruptcySoftware').mockResolvedValue();

    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const input = screen.getByLabelText('Add New Software') as HTMLInputElement;
    const saveButton = screen.getByRole('button', { name: 'Add Software' });

    await userEvent.type(input, 'Test Software');
    expect(input.value).toBe('Test Software');

    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  test('should trim whitespace from input before saving', async () => {
    testingUtilities.spyOnGlobalAlert();
    const postSpy = vi.spyOn(Api2, 'postBankruptcySoftware').mockResolvedValue();

    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const input = screen.getByLabelText('Add New Software');
    const saveButton = screen.getByRole('button', { name: 'Add Software' });

    await userEvent.type(input, '   Trimmed Software   ');
    await userEvent.click(saveButton);

    const payload: Creatable<BankruptcySoftwareListItem> = {
      list: 'bankruptcy-software' as const,
      key: 'Trimmed Software',
      value: 'Trimmed Software',
    };

    expect(postSpy).toHaveBeenCalledWith(payload);
  });

  test('should keep save button disabled with only whitespace input', async () => {
    const postSpy = vi.spyOn(Api2, 'postBankruptcySoftware');

    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const input = screen.getByLabelText('Add New Software');
    const saveButton = screen.getByRole('button', { name: 'Add Software' });

    // Initially disabled
    expect(saveButton).toBeDisabled();

    // Type spaces only
    await userEvent.type(input, '   ');

    // Should still be disabled with only whitespace
    expect(saveButton).toBeDisabled();
    expect(postSpy).not.toHaveBeenCalled();
  });

  test('should handle save API error gracefully', async () => {
    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();
    const postSpy = vi
      .spyOn(Api2, 'postBankruptcySoftware')
      .mockRejectedValue(new Error('Network error'));

    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const input = screen.getByLabelText('Add New Software');
    const saveButton = screen.getByRole('button', { name: 'Add Software' });

    await userEvent.type(input, 'Test Software');
    await userEvent.click(saveButton);

    const payload: Creatable<BankruptcySoftwareListItem> = {
      list: 'bankruptcy-software' as const,
      key: 'Test Software',
      value: 'Test Software',
    };

    expect(postSpy).toHaveBeenCalledWith(payload);
    expect(globalAlertSpy.warning).toHaveBeenCalledWith(
      'Failed to add bankruptcy software. Network error',
    );
  });

  test('should handle load API error gracefully', async () => {
    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();
    vi.spyOn(Api2, 'getBankruptcySoftwareList').mockRejectedValue(new Error('Load error'));

    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).toBeInTheDocument();
    });

    expect(globalAlertSpy.warning).toHaveBeenCalledWith(
      'Failed to load bankruptcy software list. Load error',
    );
  });

  test('should reload data after successful save', async () => {
    testingUtilities.spyOnGlobalAlert();
    vi.spyOn(Api2, 'postBankruptcySoftware').mockResolvedValue();

    const updatedList = [
      ...mockSoftwareList,
      createMockBankruptcySoftwareItem('4', 'Newly Added Software'),
    ];

    const getBankruptcySoftwareListSpy = vi
      .spyOn(Api2, 'getBankruptcySoftwareList')
      .mockResolvedValueOnce({ data: mockSoftwareList }) // Initial load
      .mockResolvedValueOnce({ data: updatedList }); // After save

    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Verify initial list
    expect(screen.getAllByTestId(/software-item-/)).toHaveLength(3);

    const input = screen.getByLabelText('Add New Software');
    const saveButton = screen.getByRole('button', { name: 'Add Software' });

    await userEvent.type(input, 'Newly Added Software');
    await userEvent.click(saveButton);

    // Verify data was reloaded
    expect(getBankruptcySoftwareListSpy).toHaveBeenCalledTimes(2);
  });

  test('should display delete button for each software item', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Verify each software item has a delete button
    mockSoftwareList.forEach((software) => {
      expect(screen.getByTestId(`button-delete-button-${software._id}`)).toBeInTheDocument();
    });
  });

  test('should show confirmation dialog when delete button is clicked', async () => {
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const deleteButton = screen.getByTestId('button-delete-button-1');
    await userEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete NextChapter?');

    confirmSpy.mockRestore();
  });

  test('should delete software successfully when confirmed', async () => {
    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();
    const deleteSpy = vi.spyOn(Api2, 'deleteBankruptcySoftware').mockResolvedValue();
    const getBankruptcySoftwareListSpy = vi.spyOn(Api2, 'getBankruptcySoftwareList');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const deleteButton = screen.getByTestId('button-delete-button-1');
    await userEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete NextChapter?');
    expect(deleteSpy).toHaveBeenCalledWith('1');
    expect(globalAlertSpy.success).toHaveBeenCalledWith(
      'Bankruptcy software deleted successfully.',
    );
    expect(getBankruptcySoftwareListSpy).toHaveBeenCalledTimes(2); // Initial load + reload after delete

    confirmSpy.mockRestore();
  });

  test('should handle delete API error gracefully', async () => {
    const globalAlertSpy = testingUtilities.spyOnGlobalAlert();
    const deleteSpy = vi
      .spyOn(Api2, 'deleteBankruptcySoftware')
      .mockRejectedValue(new Error('Network error'));
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const deleteButton = screen.getByTestId('button-delete-button-1');
    await userEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledWith('Are you sure you want to delete NextChapter?');
    expect(deleteSpy).toHaveBeenCalledWith('1');
    expect(globalAlertSpy.warning).toHaveBeenCalledWith(
      'Failed to delete bankruptcy software. Network error',
    );

    confirmSpy.mockRestore();
  });
});
