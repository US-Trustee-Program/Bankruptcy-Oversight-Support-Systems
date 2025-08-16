import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TrusteesScreen from './TrusteesScreen';
import useFeatureFlags, { TRUSTEE_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import { vi } from 'vitest';
import { CamsUser } from '@common/cams/users';

// Mock the dependencies
vi.mock('@/lib/hooks/UseFeatureFlags');
vi.mock('@/lib/utils/local-storage');
vi.mock('./TrusteesList', () => ({
  default: () => <div data-testid="trustees-list">Trustees List Component</div>,
}));

const mockUseFeatureFlags = vi.mocked(useFeatureFlags);
const mockLocalStorage = vi.mocked(LocalStorage);

function renderWithRouter(component: React.ReactElement) {
  return render(<BrowserRouter>{component}</BrowserRouter>);
}

describe('TrusteesScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should render trustees interface when feature flag is enabled and user has TrusteeAdmin role', () => {
    // Mock feature flag enabled
    mockUseFeatureFlags.mockReturnValue({
      [TRUSTEE_MANAGEMENT]: true,
    });

    // Mock user session with TrusteeAdmin role
    mockLocalStorage.getSession.mockReturnValue({
      accessToken: 'fake-token',
      provider: 'test',
      issuer: 'test-issuer',
      expires: 1,
      user: {
        id: 'user-1',
        name: 'Test User',
        roles: [CamsRole.TrusteeAdmin],
      },
    });

    renderWithRouter(<TrusteesScreen />);

    // Check that the main components are rendered
    expect(screen.getByText('Trustees')).toBeInTheDocument();
    expect(screen.getByText('Add New Trustee')).toBeInTheDocument();
    expect(screen.getByTestId('trustees-add-link')).toBeInTheDocument();
    expect(screen.getByTestId('trustees-list')).toBeInTheDocument();

    // Check the Add New Trustee link
    const addLink = screen.getByTestId('trustees-add-link');
    expect(addLink).toHaveAttribute('href', '/trustees/create');
    expect(addLink).toHaveClass('usa-button');
  });

  test('should not render when feature flag is disabled', () => {
    // Mock feature flag disabled
    mockUseFeatureFlags.mockReturnValue({
      [TRUSTEE_MANAGEMENT]: false,
    });

    // Mock user session with TrusteeAdmin role
    mockLocalStorage.getSession.mockReturnValue({
      accessToken: 'fake-token',
      provider: 'test',
      issuer: 'test-issuer',
      expires: 5,
      user: {
        id: 'user-1',
        name: 'Test User',
        roles: [CamsRole.TrusteeAdmin],
      },
    });

    const { container } = renderWithRouter(<TrusteesScreen />);

    // Component should return null and render nothing
    expect(container.firstChild).toBeNull();
  });

  test('should not render when user does not have TrusteeAdmin role', () => {
    // Mock feature flag enabled
    mockUseFeatureFlags.mockReturnValue({
      [TRUSTEE_MANAGEMENT]: true,
    });

    // Mock user session without TrusteeAdmin role
    mockLocalStorage.getSession.mockReturnValue({
      accessToken: 'fake-token',
      provider: 'test',
      issuer: 'test-issuer',
      expires: 5,
      user: {
        id: 'user-1',
        name: 'Test User',
        roles: [CamsRole.CaseAssignmentManager], // Different role
      },
    });

    const { container } = renderWithRouter(<TrusteesScreen />);

    // Component should return null and render nothing
    expect(container.firstChild).toBeNull();
  });

  test('should not render when user has no roles', () => {
    // Mock feature flag enabled
    mockUseFeatureFlags.mockReturnValue({
      [TRUSTEE_MANAGEMENT]: true,
    });

    // Mock user session with no roles
    mockLocalStorage.getSession.mockReturnValue({
      accessToken: 'fake-token',
      provider: 'test',
      issuer: 'test-issuer',
      expires: 5,
      user: {
        id: 'user-1',
        name: 'Test User',
        roles: [], // No roles
      },
    });

    const { container } = renderWithRouter(<TrusteesScreen />);

    // Component should return null and render nothing
    expect(container.firstChild).toBeNull();
  });

  test('should not render when user session is null', () => {
    // Mock feature flag enabled
    mockUseFeatureFlags.mockReturnValue({
      [TRUSTEE_MANAGEMENT]: true,
    });

    // Mock no user session
    mockLocalStorage.getSession.mockReturnValue(null);

    const { container } = renderWithRouter(<TrusteesScreen />);

    // Component should return null and render nothing
    expect(container.firstChild).toBeNull();
  });

  test('should not render when user is undefined', () => {
    // Mock feature flag enabled
    mockUseFeatureFlags.mockReturnValue({
      [TRUSTEE_MANAGEMENT]: true,
    });

    // Mock session with undefined user
    mockLocalStorage.getSession.mockReturnValue({
      accessToken: 'fake-token',
      provider: 'test',
      issuer: 'test-issuer',
      expires: 5,
      user: {} as CamsUser,
    });

    const { container } = renderWithRouter(<TrusteesScreen />);

    // Component should return null and render nothing
    expect(container.firstChild).toBeNull();
  });

  test('should not render when both feature flag is disabled and user lacks permission', () => {
    // Mock feature flag disabled
    mockUseFeatureFlags.mockReturnValue({
      [TRUSTEE_MANAGEMENT]: false,
    });

    // Mock user session without TrusteeAdmin role
    mockLocalStorage.getSession.mockReturnValue({
      accessToken: 'fake-token',
      provider: 'test',
      issuer: 'test-issuer',
      expires: 5,
      user: {
        id: 'user-1',
        name: 'Test User',
        roles: [CamsRole.CaseAssignmentManager],
      },
    });

    const { container } = renderWithRouter(<TrusteesScreen />);

    // Component should return null and render nothing
    expect(container.firstChild).toBeNull();
  });
});
