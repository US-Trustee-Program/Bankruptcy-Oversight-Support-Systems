import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NotificationRouting } from './NotificationRouting';
import Api2 from '@/lib/models/api2';
import { NotificationRoutingRecord } from '@common/cams/notifications';

const existingRecords: NotificationRoutingRecord[] = [
  {
    id: 'default-chapter-oversight',
    documentType: 'NOTIFICATION_ROUTING',
    covers: ['chapter:7', 'chapter:11', 'chapter:12', 'chapter:13'],
    recipientAddresses: ['oversight@ustp.gov'],
    displayName: 'Default Chapter Oversight',
  },
  {
    id: 'subchapter-v-oversight',
    documentType: 'NOTIFICATION_ROUTING',
    covers: ['chapter:11-subchapter-v'],
    recipientAddresses: ['subv@ustp.gov'],
    displayName: 'Subchapter V Oversight',
  },
  {
    id: '341-meeting-oversight',
    documentType: 'NOTIFICATION_ROUTING',
    covers: ['category:zoom-341'],
    recipientAddresses: ['zoom-341@ustp.gov'],
    displayName: '341 Meeting Oversight',
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
    vi.spyOn(Api2, 'getNotificationRouting').mockResolvedValue({ data: existingRecords });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should show loading state initially', () => {
    renderComponent();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('should render three labeled email fields after loading', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('routing-email-default-chapter-oversight')).toBeInTheDocument();
      expect(screen.getByTestId('routing-email-subchapter-v-oversight')).toBeInTheDocument();
      expect(screen.getByTestId('routing-email-341-meeting-oversight')).toBeInTheDocument();
    });
  });

  test('should populate fields from existing routing records', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('routing-email-default-chapter-oversight')).toHaveValue(
        'oversight@ustp.gov',
      );
      expect(screen.getByTestId('routing-email-subchapter-v-oversight')).toHaveValue(
        'subv@ustp.gov',
      );
      expect(screen.getByTestId('routing-email-341-meeting-oversight')).toHaveValue(
        'zoom-341@ustp.gov',
      );
    });
  });

  test('should show empty fields when no records exist', async () => {
    vi.spyOn(Api2, 'getNotificationRouting').mockResolvedValue({ data: [] });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('routing-email-default-chapter-oversight')).toHaveValue('');
      expect(screen.getByTestId('routing-email-subchapter-v-oversight')).toHaveValue('');
      expect(screen.getByTestId('routing-email-341-meeting-oversight')).toHaveValue('');
    });
  });

  test('should show error alert when fetch fails', async () => {
    vi.spyOn(Api2, 'getNotificationRouting').mockRejectedValue(new Error('network error'));
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('alert-container-routing-load-error')).toBeInTheDocument();
    });
  });

  test('should call updateNotificationRouting when email is changed and saved', async () => {
    const updateSpy = vi.spyOn(Api2, 'updateNotificationRouting').mockResolvedValue({
      data: { ...existingRecords[0], recipientAddresses: ['new-oversight@ustp.gov'] },
    });

    renderComponent();
    const input = await screen.findByTestId('routing-email-default-chapter-oversight');
    fireEvent.change(input, { target: { value: 'new-oversight@ustp.gov' } });

    const saveButton = screen.getByTestId('button-save-routing-button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('default-chapter-oversight', {
        recipientAddresses: ['new-oversight@ustp.gov'],
      });
    });
  });

  test('should call updateNotificationRouting with multiple addresses when second email is added', async () => {
    const updateSpy = vi.spyOn(Api2, 'updateNotificationRouting').mockResolvedValue({
      data: {
        ...existingRecords[0],
        recipientAddresses: ['oversight@ustp.gov', 'backup@ustp.gov'],
      },
    });

    renderComponent();
    await screen.findByTestId('routing-email-default-chapter-oversight');

    const addButton = screen.getByTestId('add-email-default-chapter-oversight');
    fireEvent.click(addButton);

    const secondInput = screen.getByTestId('routing-email-default-chapter-oversight-1');
    fireEvent.change(secondInput, { target: { value: 'backup@ustp.gov' } });

    const saveButton = screen.getByTestId('button-save-routing-button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('default-chapter-oversight', {
        recipientAddresses: ['oversight@ustp.gov', 'backup@ustp.gov'],
      });
    });
  });

  test('should show validation error for invalid email', async () => {
    renderComponent();
    const input = await screen.findByTestId('routing-email-default-chapter-oversight');
    fireEvent.change(input, { target: { value: 'not-an-email' } });

    const saveButton = screen.getByTestId('button-save-routing-button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId('routing-form-errors')).toBeInTheDocument();
    });
  });

  test('should not call update when email has not changed', async () => {
    const updateSpy = vi.spyOn(Api2, 'updateNotificationRouting').mockResolvedValue({
      data: existingRecords[0],
    });

    renderComponent();
    await screen.findByTestId('routing-email-default-chapter-oversight');

    const saveButton = screen.getByTestId('button-save-routing-button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  test('should show success message after saving', async () => {
    vi.spyOn(Api2, 'updateNotificationRouting').mockResolvedValue({
      data: { ...existingRecords[0], recipientAddresses: ['new@ustp.gov'] },
    });

    renderComponent();
    const input = await screen.findByTestId('routing-email-default-chapter-oversight');
    fireEvent.change(input, { target: { value: 'new@ustp.gov' } });

    const saveButton = screen.getByTestId('button-save-routing-button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId('alert-container-routing-save-success')).toBeInTheDocument();
    });
  });

  test('should add record to state when saving a previously unconfigured recipient', async () => {
    vi.spyOn(Api2, 'getNotificationRouting').mockResolvedValue({ data: [] });
    vi.spyOn(Api2, 'updateNotificationRouting').mockResolvedValue({
      data: {
        id: 'default-chapter-oversight',
        documentType: 'NOTIFICATION_ROUTING',
        covers: ['chapter:7', 'chapter:11', 'chapter:12', 'chapter:13'],
        recipientAddresses: ['new@ustp.gov'],
        displayName: 'Default Chapter Oversight',
      },
    });

    renderComponent();
    const input = await screen.findByTestId('routing-email-default-chapter-oversight');
    fireEvent.change(input, { target: { value: 'new@ustp.gov' } });

    const saveButton = screen.getByTestId('button-save-routing-button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId('alert-container-routing-save-success')).toBeInTheDocument();
    });
  });

  test('should show API error when save fails', async () => {
    vi.spyOn(Api2, 'updateNotificationRouting').mockRejectedValue(new Error('Server error'));

    renderComponent();
    const input = await screen.findByTestId('routing-email-default-chapter-oversight');
    fireEvent.change(input, { target: { value: 'new@ustp.gov' } });

    const saveButton = screen.getByTestId('button-save-routing-button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId('routing-form-errors')).toBeInTheDocument();
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  test('should render display names as labels', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Default Chapter Oversight')).toBeInTheDocument();
      expect(screen.getByText('Subchapter V Oversight')).toBeInTheDocument();
      expect(screen.getByText('341 Meeting Oversight')).toBeInTheDocument();
    });
  });
});
