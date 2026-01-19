import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import ZoomInfoCard from './ZoomInfoCard';
import { ZoomInfo } from '@common/cams/trustees';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';
import MockData from '@common/cams/test-utilities/mock-data';

describe('ZoomInfoCard', () => {
  let userEvent: CamsUserEvent;
  const mockOnEdit = vi.fn();
  const testPasscode = MockData.randomAlphaNumeric(10);

  beforeEach(() => {
    vi.clearAllMocks();
    userEvent = TestingUtilities.setupUserEvent();
  });

  const mockZoomInfo: ZoomInfo = {
    link: 'https://zoom.us/j/123456789',
    phone: '1-555-123-4567',
    meetingId: '123456789',
    passcode: testPasscode,
  };

  test('should render zoom info card with heading', () => {
    render(<ZoomInfoCard zoomInfo={mockZoomInfo} onEdit={mockOnEdit} />);

    expect(screen.getByTestId('zoom-info-heading')).toHaveTextContent('341 Meeting');
  });

  test('should render "No information has been entered" when zoomInfo is undefined', () => {
    render(<ZoomInfoCard zoomInfo={undefined} onEdit={mockOnEdit} />);

    expect(screen.getByTestId('zoom-info-empty-message')).toHaveTextContent(
      'No information has been entered.',
    );
  });

  test('should render zoom link when zoomInfo is provided', () => {
    render(<ZoomInfoCard zoomInfo={mockZoomInfo} onEdit={mockOnEdit} />);

    const zoomLink = screen.getByTestId('zoom-link');
    expect(zoomLink).toHaveAttribute('href', 'https://zoom.us/j/123456789');
    expect(zoomLink).toHaveAttribute('target', '_blank');
    expect(zoomLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('should render phone number as a clickable link', () => {
    render(<ZoomInfoCard zoomInfo={mockZoomInfo} onEdit={mockOnEdit} />);

    const phoneLink = screen.getByTestId('zoom-phone').querySelector('a');
    expect(phoneLink).toHaveAttribute('href', 'tel:1-555-123-4567');
  });

  test('should render passcode', () => {
    render(<ZoomInfoCard zoomInfo={mockZoomInfo} onEdit={mockOnEdit} />);

    expect(screen.getByTestId('zoom-passcode')).toHaveTextContent(`Passcode: ${testPasscode}`);
  });

  test('should format 9-digit meeting ID with spaces', () => {
    const zoomInfoWith9Digits: ZoomInfo = {
      ...mockZoomInfo,
      meetingId: '123456789',
    };

    render(<ZoomInfoCard zoomInfo={zoomInfoWith9Digits} onEdit={mockOnEdit} />);

    expect(screen.getByTestId('zoom-meeting-id')).toHaveTextContent('Meeting ID: 123 456 789');
  });

  test('should format 10-digit meeting ID with spaces', () => {
    const zoomInfoWith10Digits: ZoomInfo = {
      ...mockZoomInfo,
      meetingId: '1234567890',
    };

    render(<ZoomInfoCard zoomInfo={zoomInfoWith10Digits} onEdit={mockOnEdit} />);

    expect(screen.getByTestId('zoom-meeting-id')).toHaveTextContent('Meeting ID: 123 456 7890');
  });

  test('should format 11-digit meeting ID with spaces', () => {
    const zoomInfoWith11Digits: ZoomInfo = {
      ...mockZoomInfo,
      meetingId: '12345678901',
    };

    render(<ZoomInfoCard zoomInfo={zoomInfoWith11Digits} onEdit={mockOnEdit} />);

    expect(screen.getByTestId('zoom-meeting-id')).toHaveTextContent('Meeting ID: 123 456 78901');
  });

  test('should not format meeting ID with less than 9 digits', () => {
    const zoomInfoWith8Digits: ZoomInfo = {
      ...mockZoomInfo,
      meetingId: '12345678',
    };

    render(<ZoomInfoCard zoomInfo={zoomInfoWith8Digits} onEdit={mockOnEdit} />);

    expect(screen.getByTestId('zoom-meeting-id')).toHaveTextContent('Meeting ID: 12345678');
  });

  test('should not format meeting ID with more than 11 digits', () => {
    const zoomInfoWith12Digits: ZoomInfo = {
      ...mockZoomInfo,
      meetingId: '123456789012',
    };

    render(<ZoomInfoCard zoomInfo={zoomInfoWith12Digits} onEdit={mockOnEdit} />);

    expect(screen.getByTestId('zoom-meeting-id')).toHaveTextContent('Meeting ID: 123456789012');
  });

  test('should call onEdit when edit button is clicked', async () => {
    render(<ZoomInfoCard zoomInfo={mockZoomInfo} onEdit={mockOnEdit} />);

    const editButton = screen.getByRole('button', { name: 'Edit 341 meeting information' });
    await userEvent.click(editButton);

    expect(mockOnEdit).toHaveBeenCalledTimes(1);
  });

  test('should render edit button with correct attributes', () => {
    render(<ZoomInfoCard zoomInfo={mockZoomInfo} onEdit={mockOnEdit} />);

    const editButton = screen.getByRole('button', { name: 'Edit 341 meeting information' });
    expect(editButton).toHaveAttribute('id', 'edit-zoom-info');
    expect(editButton).toHaveAttribute('title', 'Edit 341 meeting information');
  });

  test('should render copy button for zoom link', () => {
    render(<ZoomInfoCard zoomInfo={mockZoomInfo} onEdit={mockOnEdit} />);

    const copyButton = screen.getByRole('button', { name: 'Copy Zoom link' });
    expect(copyButton).toBeInTheDocument();
    expect(copyButton).toHaveAttribute('id', 'copy-zoom-link');
  });
});
