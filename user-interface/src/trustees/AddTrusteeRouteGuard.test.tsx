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
  default: () => <div data-testid="trustee-create-form">Trustee Create Form</div>,
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
    vi.clearAllMocks();
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

    expect(screen.getByTestId('trustee-create-form')).toBeInTheDocument();
  });

  test('redirects to /trustees once ready when the flag is disabled', () => {
    mockUseFeatureFlagReadiness.mockReturnValue({ isReady: true, hasTimedOut: true });
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
});
