import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { NotificationRouting } from './NotificationRouting';
import Api2 from '@/lib/models/api2';
import { NotificationRoutingRecord } from '@common/cams/notifications';

const existingRecords: NotificationRoutingRecord[] = [
  {
    id: 'chapter-7-oversight',
    documentType: 'NOTIFICATION_ROUTING',
    covers: ['chapter:7'],
    recipientAddresses: ['ch7-oversight@ustp.gov'],
    displayName: 'Chapter 7 Oversight',
  },
  {
    id: 'chapter-11-oversight',
    documentType: 'NOTIFICATION_ROUTING',
    covers: ['chapter:11'],
    recipientAddresses: ['ch11-oversight@ustp.gov'],
    displayName: 'Chapter 11 Oversight',
  },
  {
    id: 'chapter-12-oversight',
    documentType: 'NOTIFICATION_ROUTING',
    covers: ['chapter:12'],
    recipientAddresses: ['ch12-oversight@ustp.gov'],
    displayName: 'Chapter 12 Oversight',
  },
  {
    id: 'chapter-13-oversight',
    documentType: 'NOTIFICATION_ROUTING',
    covers: ['chapter:13'],
    recipientAddresses: ['ch13-oversight@ustp.gov'],
    displayName: 'Chapter 13 Oversight',
  },
  {
    id: 'subchapter-v-oversight',
    documentType: 'NOTIFICATION_ROUTING',
    covers: ['chapter:11-subchapter-v'],
    recipientAddresses: ['subv@ustp.gov'],
    displayName: 'Chapter 11 Subchapter V',
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

  test('should render six labeled email fields after loading', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('routing-email-chapter-7-oversight')).toBeInTheDocument();
      expect(screen.getByTestId('routing-email-chapter-11-oversight')).toBeInTheDocument();
      expect(screen.getByTestId('routing-email-chapter-12-oversight')).toBeInTheDocument();
      expect(screen.getByTestId('routing-email-chapter-13-oversight')).toBeInTheDocument();
      expect(screen.getByTestId('routing-email-subchapter-v-oversight')).toBeInTheDocument();
      expect(screen.getByTestId('routing-email-341-meeting-oversight')).toBeInTheDocument();
    });
  });

  test('should populate fields from existing routing records', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId('routing-email-chapter-7-oversight')).toHaveValue(
        'ch7-oversight@ustp.gov',
      );
      expect(screen.getByTestId('routing-email-chapter-11-oversight')).toHaveValue(
        'ch11-oversight@ustp.gov',
      );
      expect(screen.getByTestId('routing-email-chapter-12-oversight')).toHaveValue(
        'ch12-oversight@ustp.gov',
      );
      expect(screen.getByTestId('routing-email-chapter-13-oversight')).toHaveValue(
        'ch13-oversight@ustp.gov',
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
      expect(screen.getByTestId('routing-email-chapter-7-oversight')).toHaveValue('');
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
    const input = await screen.findByTestId('routing-email-chapter-7-oversight');
    fireEvent.change(input, { target: { value: 'new-oversight@ustp.gov' } });

    const saveButton = screen.getByTestId('button-save-routing-button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('chapter-7-oversight', {
        recipientAddresses: ['new-oversight@ustp.gov'],
      });
    });
  });

  test('should call updateNotificationRouting with multiple addresses when second email is added', async () => {
    const updateSpy = vi.spyOn(Api2, 'updateNotificationRouting').mockResolvedValue({
      data: {
        ...existingRecords[0],
        recipientAddresses: ['ch7-oversight@ustp.gov', 'backup@ustp.gov'],
      },
    });

    renderComponent();
    await screen.findByTestId('routing-email-chapter-7-oversight');

    const addButton = screen.getByTestId('add-email-chapter-7-oversight');
    fireEvent.click(addButton);

    const secondInput = screen.getByTestId('routing-email-chapter-7-oversight-1');
    fireEvent.change(secondInput, { target: { value: 'backup@ustp.gov' } });

    const saveButton = screen.getByTestId('button-save-routing-button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('chapter-7-oversight', {
        recipientAddresses: ['ch7-oversight@ustp.gov', 'backup@ustp.gov'],
      });
    });
  });

  test('should show inline validation error for invalid email', async () => {
    renderComponent();
    const input = await screen.findByTestId('routing-email-chapter-7-oversight');
    fireEvent.change(input, { target: { value: 'not-an-email' } });

    const saveButton = screen.getByTestId('button-save-routing-button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId('routing-email-error-chapter-7-oversight-0')).toBeInTheDocument();
      expect(screen.getByText('Must be a valid email address')).toBeInTheDocument();
    });
  });

  test('should not call update when email has not changed', async () => {
    const updateSpy = vi.spyOn(Api2, 'updateNotificationRouting').mockResolvedValue({
      data: existingRecords[0],
    });

    renderComponent();
    await screen.findByTestId('routing-email-chapter-7-oversight');

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
    const input = await screen.findByTestId('routing-email-chapter-7-oversight');
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
        id: 'chapter-7-oversight',
        documentType: 'NOTIFICATION_ROUTING',
        covers: ['chapter:7'],
        recipientAddresses: ['new@ustp.gov'],
        displayName: 'Chapter 7 Oversight',
      },
    });

    renderComponent();
    const input = await screen.findByTestId('routing-email-chapter-7-oversight');
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
    const input = await screen.findByTestId('routing-email-chapter-7-oversight');
    fireEvent.change(input, { target: { value: 'new@ustp.gov' } });

    const saveButton = screen.getByTestId('button-save-routing-button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByTestId('routing-form-errors')).toBeInTheDocument();
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });

  test('should allow saving when all addresses in a section are cleared', async () => {
    const updateSpy = vi.spyOn(Api2, 'updateNotificationRouting').mockResolvedValue({
      data: { ...existingRecords[0], recipientAddresses: [] },
    });

    renderComponent();
    const input = await screen.findByTestId('routing-email-chapter-7-oversight');
    fireEvent.change(input, { target: { value: '' } });

    const saveButton = screen.getByTestId('button-save-routing-button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('chapter-7-oversight', {
        recipientAddresses: [],
      });
      expect(screen.getByTestId('alert-container-routing-save-success')).toBeInTheDocument();
    });
  });

  test('should reload data after a successful save', async () => {
    const reloadedRecords = existingRecords.map((r) =>
      r.id === 'chapter-7-oversight' ? { ...r, recipientAddresses: ['updated@ustp.gov'] } : r,
    );
    const getSpy = vi
      .spyOn(Api2, 'getNotificationRouting')
      .mockResolvedValueOnce({ data: existingRecords })
      .mockResolvedValueOnce({ data: reloadedRecords });
    vi.spyOn(Api2, 'updateNotificationRouting').mockResolvedValue({
      data: reloadedRecords[0],
    });

    renderComponent();
    const input = await screen.findByTestId('routing-email-chapter-7-oversight');
    fireEvent.change(input, { target: { value: 'updated@ustp.gov' } });

    fireEvent.click(screen.getByTestId('button-save-routing-button'));

    await waitFor(() => {
      expect(getSpy).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('routing-email-chapter-7-oversight')).toHaveValue(
        'updated@ustp.gov',
      );
    });
  });

  test('should not show success message when the post-save reload fails', async () => {
    vi.spyOn(Api2, 'getNotificationRouting')
      .mockResolvedValueOnce({ data: existingRecords })
      .mockRejectedValueOnce(new Error('reload failed'));
    vi.spyOn(Api2, 'updateNotificationRouting').mockResolvedValue({
      data: { ...existingRecords[0], recipientAddresses: ['updated@ustp.gov'] },
    });

    renderComponent();
    const input = await screen.findByTestId('routing-email-chapter-7-oversight');
    fireEvent.change(input, { target: { value: 'updated@ustp.gov' } });

    fireEvent.click(screen.getByTestId('button-save-routing-button'));

    await waitFor(() => {
      expect(screen.getByTestId('alert-container-routing-load-error')).toBeInTheDocument();
      expect(screen.queryByTestId('alert-container-routing-save-success')).not.toBeInTheDocument();
    });
  });

  test('should render display names as labels', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('Chapter 7 Oversight')).toBeInTheDocument();
      expect(screen.getByText('Chapter 11 Oversight')).toBeInTheDocument();
      expect(screen.getByText('Chapter 12 Oversight')).toBeInTheDocument();
      expect(screen.getByText('Chapter 13 Oversight')).toBeInTheDocument();
      expect(screen.getByText('Chapter 11 Subchapter V')).toBeInTheDocument();
      expect(screen.getByText('341 Meeting Oversight')).toBeInTheDocument();
    });
  });
});
