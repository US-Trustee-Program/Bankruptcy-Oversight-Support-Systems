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

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={['/trustees/create']}>
      <Routes>
        <Route path="/trustees" element={<div data-testid="trustees-list-page">Trustees</div>} />
        <Route path="/trustees/create" element={<AddTrusteeRouteGuard />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AddTrusteeRouteGuard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('renders nothing while feature flags are not ready', () => {
    mockUseFeatureFlagReadiness.mockReturnValue({ isReady: false, hasTimedOut: false });
    mockUseFeatureFlags.mockReturnValue({});

    const { container } = renderGuard();

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('trustee-create-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trustees-list-page')).not.toBeInTheDocument();
  });

  test('renders the create form once ready and the flag is enabled', () => {
    mockUseFeatureFlagReadiness.mockReturnValue({ isReady: true, hasTimedOut: true });
    mockUseFeatureFlags.mockReturnValue({ [RESTRICT_ADDING_TRUSTEES]: true });

    renderGuard();

    const form = screen.getByTestId('trustee-create-form');
    expect(form).toBeInTheDocument();
    expect(form).toHaveTextContent('"action":"create"');
    expect(form).toHaveTextContent('"cancelTo":"/trustees"');
  });

  test('redirects to /trustees once ready when the flag is disabled', () => {
    mockUseFeatureFlagReadiness.mockReturnValue({ isReady: true, hasTimedOut: true });
    mockUseFeatureFlags.mockReturnValue({ [RESTRICT_ADDING_TRUSTEES]: false });

    renderGuard();

    expect(screen.getByTestId('trustees-list-page')).toBeInTheDocument();
    expect(screen.queryByTestId('trustee-create-form')).not.toBeInTheDocument();
  });

  test('redirects to /trustees once the flag value arrives as false, even before the grace period elapses', () => {
    mockUseFeatureFlagReadiness.mockReturnValue({ isReady: true, hasTimedOut: false });
    mockUseFeatureFlags.mockReturnValue({ [RESTRICT_ADDING_TRUSTEES]: false });

    renderGuard();

    expect(screen.getByTestId('trustees-list-page')).toBeInTheDocument();
    expect(screen.queryByTestId('trustee-create-form')).not.toBeInTheDocument();
  });

  test('redirects to /trustees once ready when the flag is absent', () => {
    mockUseFeatureFlagReadiness.mockReturnValue({ isReady: true, hasTimedOut: true });
    mockUseFeatureFlags.mockReturnValue({});

    renderGuard();

    expect(screen.getByTestId('trustees-list-page')).toBeInTheDocument();
    expect(screen.queryByTestId('trustee-create-form')).not.toBeInTheDocument();
  });

  test('renders nothing when the LD client is ready but the flag has not populated and the grace period has not elapsed', () => {
    mockUseFeatureFlagReadiness.mockReturnValue({ isReady: true, hasTimedOut: false });
    mockUseFeatureFlags.mockReturnValue({});

    const { container } = renderGuard();

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('trustee-create-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trustees-list-page')).not.toBeInTheDocument();
  });

  test('renders the create form once the flag value arrives, even before the grace period elapses', () => {
    mockUseFeatureFlagReadiness.mockReturnValue({ isReady: true, hasTimedOut: false });
    mockUseFeatureFlags.mockReturnValue({ [RESTRICT_ADDING_TRUSTEES]: true });

    renderGuard();

    const form = screen.getByTestId('trustee-create-form');
    expect(form).toBeInTheDocument();
    expect(form).toHaveTextContent('"action":"create"');
    expect(form).toHaveTextContent('"cancelTo":"/trustees"');
  });
});
