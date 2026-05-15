import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { NavigationTracker } from './NavigationTracker';
import * as UseLandingPageAnalytics from '@/lib/hooks/UseLandingPageAnalytics';
import { CASE_SEARCH_PATH, LOGIN_SUCCESS_PATH } from '@/login/login-library';
import { act } from 'react';

const mockTrackNavigation = vi.fn();

function setupAnalyticsSpy() {
  vi.spyOn(UseLandingPageAnalytics, 'useLandingPageAnalytics').mockReturnValue({
    trackNavigation: mockTrackNavigation,
    trackFirstSearch: vi.fn(),
  });
}

function NavigatorHelper({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button data-testid="navigate-btn" onClick={() => navigate(to)}>
      Go
    </button>
  );
}

function renderTracker(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <NavigationTracker />
      <Routes>
        <Route path="*" element={<NavigatorHelper to="/case-detail/123" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NavigationTracker', () => {
  beforeEach(() => {
    mockTrackNavigation.mockClear();
    setupAnalyticsSpy();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should not track on first render (no previous path)', () => {
    renderTracker(CASE_SEARCH_PATH);
    expect(mockTrackNavigation).not.toHaveBeenCalled();
  });

  test('should track navigation away from CASE_SEARCH_PATH', () => {
    const { getByTestId } = renderTracker(CASE_SEARCH_PATH);
    act(() => getByTestId('navigate-btn').click());
    expect(mockTrackNavigation).toHaveBeenCalledWith('/case-detail/123');
  });

  test('should only track first navigation away from CASE_SEARCH_PATH', () => {
    const { getByTestId } = renderTracker(CASE_SEARCH_PATH);
    act(() => getByTestId('navigate-btn').click());
    act(() => getByTestId('navigate-btn').click());
    expect(mockTrackNavigation).toHaveBeenCalledTimes(1);
  });

  test('should track navigation away from LOGIN_SUCCESS_PATH', () => {
    const { getByTestId } = renderTracker(LOGIN_SUCCESS_PATH);
    act(() => getByTestId('navigate-btn').click());
    expect(mockTrackNavigation).toHaveBeenCalledWith('/case-detail/123');
  });

  test('should not track navigation when previous path is not a landing page', () => {
    const { getByTestId } = renderTracker('/some-other-path');
    act(() => getByTestId('navigate-btn').click());
    expect(mockTrackNavigation).not.toHaveBeenCalled();
  });
});
