import { render, screen, waitFor } from '@testing-library/react';
import { describe, beforeEach, vi, MockedFunction } from 'vitest';
import { AuthorizedUseOnly } from './AuthorizedUseOnly';

// Mock the LocalStorage module
vi.mock('@/lib/utils/local-storage', () => ({
  default: {
    getAck: vi.fn(),
    setAck: vi.fn(),
  },
}));
import LocalStorage from '@/lib/utils/local-storage';
import TestingUtilities, { CamsUserEvent } from '@/lib/testing/testing-utilities';

const mockGetAck = LocalStorage.getAck as MockedFunction<typeof LocalStorage.getAck>;
const mockSetAck = LocalStorage.setAck as MockedFunction<typeof LocalStorage.setAck>;

describe('AuthorizedUseOnly', () => {
  let userEvent: CamsUserEvent;

  beforeEach(() => {
    mockGetAck.mockReturnValue(false);
    userEvent = TestingUtilities.setupUserEvent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should render warning card with government use message', () => {
    render(<AuthorizedUseOnly></AuthorizedUseOnly>);

    // Check for the card structure
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(
      screen.getByText(/You are accessing a U.S. Government information system/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /This information system is provided for U.S. Government-authorized use only/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  test('should render warning heading as h1 element', () => {
    render(<AuthorizedUseOnly></AuthorizedUseOnly>);

    const warningHeading = screen.getByText('Warning');
    expect(warningHeading.tagName.toLowerCase()).toBe('h1');
    expect(warningHeading).toHaveClass('usa-card__heading');
  });

  test('should render children when skip prop is true', async () => {
    render(
      <AuthorizedUseOnly skip={true}>
        <div data-testid="child-content">Protected Content</div>
      </AuthorizedUseOnly>,
    );

    // Wait for useEffect to complete and child content to appear
    await waitFor(() => {
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    expect(screen.queryByText('Warning')).not.toBeInTheDocument();
  });

  test('should render children when user clicks confirm button', async () => {
    render(
      <AuthorizedUseOnly>
        <div data-testid="child-content">Protected Content</div>
      </AuthorizedUseOnly>,
    );

    // Initially should show warning card
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();

    // Click confirm button
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    // Wait for state change to complete
    await waitFor(() => {
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    expect(screen.queryByText('Warning')).not.toBeInTheDocument();
  });

  test('should save acknowledgment to localStorage when confirmed', async () => {
    render(<AuthorizedUseOnly></AuthorizedUseOnly>);

    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    // Should call localStorage setAck with true
    expect(mockSetAck).toHaveBeenCalledWith(true);
  });

  test('should render children when localStorage indicates previous acknowledgment', async () => {
    // Mock localStorage to return true for acknowledgment
    mockGetAck.mockReturnValue(true);

    render(
      <AuthorizedUseOnly>
        <div data-testid="child-content">Protected Content</div>
      </AuthorizedUseOnly>,
    );

    // Should immediately show children without warning after useEffect runs
    await waitFor(() => {
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });

    expect(screen.queryByText('Warning')).not.toBeInTheDocument();
  });
});
