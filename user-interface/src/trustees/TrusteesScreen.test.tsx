import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import TrusteesScreen from './TrusteesScreen';
import useFeatureFlags, { RESTRICT_ADDING_TRUSTEES } from '@/lib/hooks/UseFeatureFlags';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsRole } from '@common/cams/roles';
import { vi } from 'vitest';
import { CamsUser } from '@common/cams/users';

// Mock the dependencies
vi.mock('@/lib/hooks/UseFeatureFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/hooks/UseFeatureFlags')>();
  return {
    ...actual,
    default: vi.fn(),
  };
});
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
    mockUseFeatureFlags.mockReturnValue({});
  });

  test('should render trustees interface when user has TrusteeAdmin role', () => {
    mockUseFeatureFlags.mockReturnValue({
      [RESTRICT_ADDING_TRUSTEES]: true,
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

  test('should not render Add New Trustee link when restrict-adding-trustees flag is false', () => {
    mockUseFeatureFlags.mockReturnValue({
      [RESTRICT_ADDING_TRUSTEES]: false,
    });

    // Mock user session with TrusteeAdmin role (passes the screen-level gate)
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

    // Rest of the screen still renders
    expect(screen.getByText('Trustees')).toBeInTheDocument();
    expect(screen.getByTestId('trustees-list')).toBeInTheDocument();

    // Only the Add New Trustee link is gated off
    expect(screen.queryByTestId('trustees-add-link')).not.toBeInTheDocument();
    expect(screen.queryByText('Add New Trustee')).not.toBeInTheDocument();
  });

  test('should not render when user does not have TrusteeAdmin role', () => {
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
    // Mock no user session
    mockLocalStorage.getSession.mockReturnValue(null);

    const { container } = renderWithRouter(<TrusteesScreen />);

    // Component should return null and render nothing
    expect(container.firstChild).toBeNull();
  });

  test('should not render when user is undefined', () => {
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

  test('should render the outlet directly, bypassing the role gate, when a nested route is active', () => {
    // Mirrors what AddTrusteeRouteGuard depends on at /trustees/create: even with no
    // session, the nested route's content must still render.
    mockLocalStorage.getSession.mockReturnValue(null);

    render(
      <MemoryRouter initialEntries={['/trustees/create']}>
        <Routes>
          <Route path="/trustees" element={<TrusteesScreen />}>
            <Route path="create" element={<div data-testid="nested-route-content">Nested</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('trustees')).toBeInTheDocument();
    expect(screen.getByTestId('nested-route-content')).toBeInTheDocument();
    expect(screen.queryByText('Add New Trustee')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trustees-list')).not.toBeInTheDocument();
  });
});
