import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NotificationRouting } from './NotificationRouting';
import Api2 from '@/lib/models/api2';
import { NotificationRoutingRecord } from '@common/cams/notifications';

const mockRoutingRecords: NotificationRoutingRecord[] = [
  {
    id: 'routing-1',
    documentType: 'NOTIFICATION_ROUTING',
    key: 'chapter:7',
    recipientAddress: 'ch7@example.com',
    displayName: 'Chapter 7 Team',
  },
  {
    id: 'routing-2',
    documentType: 'NOTIFICATION_ROUTING',
    key: 'chapter:11',
    recipientAddress: 'ch11@example.com',
  },
];

function renderComponent() {
  return render(
    <BrowserRouter>
      <NotificationRouting />
    </BrowserRouter>,
  );
}

describe('NotificationRouting component', () => {
  beforeEach(() => {
    vi.stubEnv('CAMS_USE_FAKE_API', 'true');
    vi.spyOn(Api2, 'getNotificationRouting').mockResolvedValue({ data: mockRoutingRecords });
    vi.spyOn(Api2, 'getNotificationConfig').mockResolvedValue({ data: { enabled: true } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should show loading state initially', () => {
    renderComponent();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('should render routing table after loading', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('notification-routing-table')).toBeInTheDocument();
    });
  });

  test('should render column headers', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Key')).toBeInTheDocument();
      expect(screen.getByText('Recipient Address')).toBeInTheDocument();
      expect(screen.getByText('Display Name')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });

  test('should render routing records in table', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('chapter:7')).toBeInTheDocument();
      expect(screen.getByText('ch7@example.com')).toBeInTheDocument();
      expect(screen.getByText('Chapter 7 Team')).toBeInTheDocument();
      expect(screen.getByText('chapter:11')).toBeInTheDocument();
      expect(screen.getByText('ch11@example.com')).toBeInTheDocument();
    });
  });

  test('should render "Add Routing" button', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('button-add-routing-button')).toBeInTheDocument();
    });
  });

  test('should show error alert when fetch fails', async () => {
    vi.spyOn(Api2, 'getNotificationRouting').mockRejectedValue(new Error('network error'));
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('alert-container-routing-load-error')).toBeInTheDocument();
    });
  });

  test('should display notifications enabled status', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Notifications: Enabled')).toBeInTheDocument();
    });
  });

  test('should display notifications disabled status', async () => {
    vi.spyOn(Api2, 'getNotificationConfig').mockResolvedValue({ data: { enabled: false } });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Notifications: Disabled')).toBeInTheDocument();
    });
  });

  test('should toggle notification config when toggle button is clicked', async () => {
    const updateConfigSpy = vi
      .spyOn(Api2, 'updateNotificationConfig')
      .mockResolvedValue({ data: { enabled: false } });

    renderComponent();
    const toggleButton = await screen.findByTestId('button-toggle-notifications-button');
    fireEvent.click(toggleButton);

    await waitFor(() => {
      expect(updateConfigSpy).toHaveBeenCalledWith({ enabled: false });
    });
  });

  test('should show add form when Add Routing button is clicked', async () => {
    renderComponent();
    const addButton = await screen.findByTestId('button-add-routing-button');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByTestId('routing-form')).toBeInTheDocument();
    });
  });

  test('should create a new routing record on form submit', async () => {
    const createSpy = vi.spyOn(Api2, 'createNotificationRouting').mockResolvedValue({
      data: {
        id: 'routing-new',
        documentType: 'NOTIFICATION_ROUTING',
        key: 'chapter:12',
        recipientAddress: 'ch12@example.com',
        displayName: 'Chapter 12',
      },
    });

    renderComponent();
    const addButton = await screen.findByTestId('button-add-routing-button');
    fireEvent.click(addButton);

    const keyInput = screen.getByTestId('routing-key-input');
    const emailInput = screen.getByTestId('routing-email-input');
    const displayNameInput = screen.getByTestId('routing-display-name-input');

    fireEvent.change(keyInput, { target: { value: 'chapter:12' } });
    fireEvent.change(emailInput, { target: { value: 'ch12@example.com' } });
    fireEvent.change(displayNameInput, { target: { value: 'Chapter 12' } });

    const saveButton = screen.getByTestId('button-save-routing-button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        key: 'chapter:12',
        recipientAddress: 'ch12@example.com',
        displayName: 'Chapter 12',
      });
    });
  });

  test('should show validation error when key is empty on submit', async () => {
    renderComponent();
    const addButton = await screen.findByTestId('button-add-routing-button');
    fireEvent.click(addButton);

    const emailInput = screen.getByTestId('routing-email-input');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    const saveButton = screen.getByTestId('button-save-routing-button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Key is required.')).toBeInTheDocument();
    });
  });

  test('should show validation error when email is invalid on submit', async () => {
    renderComponent();
    const addButton = await screen.findByTestId('button-add-routing-button');
    fireEvent.click(addButton);

    const keyInput = screen.getByTestId('routing-key-input');
    const emailInput = screen.getByTestId('routing-email-input');
    fireEvent.change(keyInput, { target: { value: 'chapter:7' } });
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });

    const saveButton = screen.getByTestId('button-save-routing-button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('A valid email address is required.')).toBeInTheDocument();
    });
  });

  test('should delete a routing record when delete is clicked', async () => {
    const deleteSpy = vi.spyOn(Api2, 'deleteNotificationRouting').mockResolvedValue({ data: {} });

    renderComponent();
    const deleteButtons = await screen.findAllByTestId(/^button-delete-routing-/);
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith('routing-1');
    });
  });

  test('should show edit form when edit button is clicked', async () => {
    renderComponent();
    const editButtons = await screen.findAllByTestId(/^button-edit-routing-/);
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByTestId('routing-form')).toBeInTheDocument();
      expect(screen.getByTestId('routing-key-input')).toHaveValue('chapter:7');
      expect(screen.getByTestId('routing-email-input')).toHaveValue('ch7@example.com');
      expect(screen.getByTestId('routing-display-name-input')).toHaveValue('Chapter 7 Team');
    });
  });

  test('should update a routing record on edit form submit', async () => {
    const updateSpy = vi.spyOn(Api2, 'updateNotificationRouting').mockResolvedValue({
      data: {
        id: 'routing-1',
        documentType: 'NOTIFICATION_ROUTING',
        key: 'chapter:7',
        recipientAddress: 'updated@example.com',
        displayName: 'Updated Name',
      },
    });

    renderComponent();
    const editButtons = await screen.findAllByTestId(/^button-edit-routing-/);
    fireEvent.click(editButtons[0]);

    const emailInput = screen.getByTestId('routing-email-input');
    fireEvent.change(emailInput, { target: { value: 'updated@example.com' } });

    const saveButton = screen.getByTestId('button-save-routing-button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('routing-1', {
        key: 'chapter:7',
        recipientAddress: 'updated@example.com',
        displayName: 'Chapter 7 Team',
      });
    });
  });

  test('should cancel form when cancel button is clicked', async () => {
    renderComponent();
    const addButton = await screen.findByTestId('button-add-routing-button');
    fireEvent.click(addButton);

    expect(screen.getByTestId('routing-form')).toBeInTheDocument();

    const cancelButton = screen.getByTestId('button-cancel-routing-button');
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByTestId('routing-form')).not.toBeInTheDocument();
    });
  });
});
