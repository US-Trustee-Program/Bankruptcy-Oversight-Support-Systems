import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { vi } from 'vitest';
import { AddTrusteeRouteGuard } from './AddTrusteeRouteGuard';
import useFeatureFlags, { RESTRICT_ADDING_TRUSTEES } from '@/lib/hooks/UseFeatureFlags';
import useFeatureFlagReadiness from '@/lib/hooks/UseFeatureFlagReadiness';

vi.mock('@/lib/hooks/UseFeatureFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/hooks/UseFeatureFlags')>();
  return {
    ...actual,
    default: vi.fn(),
  };
});
vi.mock('@/lib/hooks/UseFeatureFlagReadiness');
vi.mock('./forms/TrusteePublicContactForm', () => ({
  default: (props: { action: string; cancelTo: string }) => (
    <div data-testid="trustee-create-form">{JSON.stringify(props)}</div>
  ),
}));

const mockUseFeatureFlags = vi.mocked(useFeatureFlags);
const mockUseFeatureFlagReadiness = vi.mocked(useFeatureFlagReadiness);

function guardTree() {
  return (
    <MemoryRouter initialEntries={['/trustees/create']}>
      <Routes>
        <Route path="/trustees" element={<div data-testid="trustees-list-page">Trustees</div>} />
        <Route path="/trustees/create" element={<AddTrusteeRouteGuard />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderGuard() {
  return render(guardTree());
}

function expectSpinner() {
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.queryByTestId('trustee-create-form')).not.toBeInTheDocument();
  expect(screen.queryByTestId('trustees-list-page')).not.toBeInTheDocument();
}

describe('AddTrusteeRouteGuard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('shows a loading spinner while feature flags are not ready', () => {
    mockUseFeatureFlagReadiness.mockReturnValue({
      isReady: false,
      hasTimedOut: false,
      hasIdentified: false,
    });
    mockUseFeatureFlags.mockReturnValue({});

    renderGuard();

    expectSpinner();
  });

  test('renders the create form once ready and the flag is enabled, via the timeout safety valve', () => {
    mockUseFeatureFlagReadiness.mockReturnValue({
      isReady: true,
      hasTimedOut: true,
      hasIdentified: false,
    });
    mockUseFeatureFlags.mockReturnValue({ [RESTRICT_ADDING_TRUSTEES]: true });

    renderGuard();

    const form = screen.getByTestId('trustee-create-form');
    expect(form).toBeInTheDocument();
    expect(form).toHaveTextContent('"action":"create"');
    expect(form).toHaveTextContent('"cancelTo":"/trustees"');
  });

  test('redirects to /trustees once ready when the flag is disabled, via the timeout safety valve', () => {
    mockUseFeatureFlagReadiness.mockReturnValue({
      isReady: true,
      hasTimedOut: true,
      hasIdentified: false,
    });
    mockUseFeatureFlags.mockReturnValue({ [RESTRICT_ADDING_TRUSTEES]: false });

    renderGuard();

    expect(screen.getByTestId('trustees-list-page')).toBeInTheDocument();
    expect(screen.queryByTestId('trustee-create-form')).not.toBeInTheDocument();
  });

  test('redirects to /trustees once ready when the flag is absent, via the timeout safety valve', () => {
    mockUseFeatureFlagReadiness.mockReturnValue({
      isReady: true,
      hasTimedOut: true,
      hasIdentified: false,
    });
    mockUseFeatureFlags.mockReturnValue({});

    renderGuard();

    expect(screen.getByTestId('trustees-list-page')).toBeInTheDocument();
    expect(screen.queryByTestId('trustee-create-form')).not.toBeInTheDocument();
  });

  test('shows a loading spinner when the flag has populated but identify() has not resolved yet, even though a value is already present', () => {
    // The flag already has a value (e.g. the anonymous, pre-identify context's evaluation), but
    // identify() for the real user hasn't completed. That value cannot be trusted yet -- the
    // guard must keep waiting rather than acting on it, regardless of what the value is.
    mockUseFeatureFlagReadiness.mockReturnValue({
      isReady: true,
      hasTimedOut: false,
      hasIdentified: false,
    });
    mockUseFeatureFlags.mockReturnValue({ [RESTRICT_ADDING_TRUSTEES]: false });

    renderGuard();

    expectSpinner();
  });

  test('shows a loading spinner when identified but the flag itself has not populated yet', () => {
    mockUseFeatureFlagReadiness.mockReturnValue({
      isReady: true,
      hasTimedOut: false,
      hasIdentified: true,
    });
    mockUseFeatureFlags.mockReturnValue({});

    renderGuard();

    expectSpinner();
  });

  test('renders the create form once identified and the flag is enabled, even before the grace period elapses', () => {
    mockUseFeatureFlagReadiness.mockReturnValue({
      isReady: true,
      hasTimedOut: false,
      hasIdentified: true,
    });
    mockUseFeatureFlags.mockReturnValue({ [RESTRICT_ADDING_TRUSTEES]: true });

    renderGuard();

    const form = screen.getByTestId('trustee-create-form');
    expect(form).toBeInTheDocument();
    expect(form).toHaveTextContent('"action":"create"');
    expect(form).toHaveTextContent('"cancelTo":"/trustees"');
  });

  test('redirects to /trustees once identified and the flag is disabled, even before the grace period elapses', () => {
    mockUseFeatureFlagReadiness.mockReturnValue({
      isReady: true,
      hasTimedOut: false,
      hasIdentified: true,
    });
    mockUseFeatureFlags.mockReturnValue({ [RESTRICT_ADDING_TRUSTEES]: false });

    renderGuard();

    expect(screen.getByTestId('trustees-list-page')).toBeInTheDocument();
    expect(screen.queryByTestId('trustee-create-form')).not.toBeInTheDocument();
  });

  // Regression test for the identify()-timing race originally flagged in PR review: the
  // anonymous (pre-identify) context can evaluate the flag as false and that value can arrive
  // before identify() resolves for the real, authorized user. Proves the guard now waits for
  // identify() rather than acting on the early, untrustworthy value.
  test('waits for identify() rather than acting on an early anonymous-context value, then decides correctly once identified', () => {
    mockUseFeatureFlagReadiness.mockReturnValue({
      isReady: true,
      hasTimedOut: false,
      hasIdentified: false,
    });
    mockUseFeatureFlags.mockReturnValue({ [RESTRICT_ADDING_TRUSTEES]: false });

    const { rerender } = renderGuard();

    // The anonymous context's (wrong, for this authorized user) value has already arrived, but
    // identify() has not resolved yet -- the guard must not have decided anything permanent.
    expectSpinner();

    // Simulate identify() resolving with the real user's context, which flips the flag to true.
    mockUseFeatureFlagReadiness.mockReturnValue({
      isReady: true,
      hasTimedOut: false,
      hasIdentified: true,
    });
    mockUseFeatureFlags.mockReturnValue({ [RESTRICT_ADDING_TRUSTEES]: true });
    rerender(guardTree());

    const form = screen.getByTestId('trustee-create-form');
    expect(form).toBeInTheDocument();
    expect(form).toHaveTextContent('"action":"create"');
    expect(screen.queryByTestId('trustees-list-page')).not.toBeInTheDocument();
  });
});
