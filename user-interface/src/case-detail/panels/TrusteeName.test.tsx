import { BrowserRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrusteeName } from './TrusteeName';
import { CamsRole } from '@common/cams/roles';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';

const mockTrackEvent = vi.fn();
vi.mock('@/lib/hooks/UseApplicationInsights', () => ({
  getAppInsights: () => ({
    appInsights: { trackEvent: mockTrackEvent },
  }),
}));

const TRUSTEE_NAME = 'John Doe';
const TRUSTEE_ID = 'trustee-123';

describe('TrusteeName', () => {
  let user: ReturnType<typeof MockData.getCamsUser>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = MockData.getCamsUser({ roles: [CamsRole.TrusteeAdmin] });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(MockData.getCamsSession({ user }));
  });

  test('renders the name as a link when the user has TrusteeAdmin access', () => {
    render(
      <BrowserRouter>
        <TrusteeName trusteeName={TRUSTEE_NAME} trusteeId={TRUSTEE_ID} />
      </BrowserRouter>,
    );

    const link = screen.getByTestId('case-detail-trustee-link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent(TRUSTEE_NAME);
    expect(link).toHaveAttribute('href', `/trustees/${TRUSTEE_ID}`);
  });

  test('renders the name as plain text when the user does not have TrusteeAdmin access', () => {
    const noAccessUser = MockData.getCamsUser({ roles: [] });
    vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
      MockData.getCamsSession({ user: noAccessUser }),
    );

    render(
      <BrowserRouter>
        <TrusteeName trusteeName={TRUSTEE_NAME} trusteeId={TRUSTEE_ID} />
      </BrowserRouter>,
    );

    expect(screen.queryByTestId('case-detail-trustee-link')).not.toBeInTheDocument();
    expect(screen.getByText(TRUSTEE_NAME)).toBeInTheDocument();
  });

  describe('telemetry', () => {
    test('fires "Trustee Profile Navigated" when the link is clicked', async () => {
      render(
        <BrowserRouter>
          <TrusteeName trusteeName={TRUSTEE_NAME} trusteeId={TRUSTEE_ID} />
        </BrowserRouter>,
      );

      await userEvent.click(screen.getByTestId('case-detail-trustee-link'));

      expect(mockTrackEvent).toHaveBeenCalledWith({ name: 'Trustee Profile Navigated' });
    });

    test('does not fire "Trustee Profile Navigated" when name renders as plain text', async () => {
      const noAccessUser = MockData.getCamsUser({ roles: [] });
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(
        MockData.getCamsSession({ user: noAccessUser }),
      );

      render(
        <BrowserRouter>
          <TrusteeName trusteeName={TRUSTEE_NAME} trusteeId={TRUSTEE_ID} />
        </BrowserRouter>,
      );

      expect(mockTrackEvent).not.toHaveBeenCalledWith({ name: 'Trustee Profile Navigated' });
    });
  });

  describe('openNewTab', () => {
    test('shows the launch icon when openNewTab is true', () => {
      render(
        <BrowserRouter>
          <TrusteeName trusteeName={TRUSTEE_NAME} trusteeId={TRUSTEE_ID} openNewTab />
        </BrowserRouter>,
      );

      const icon = screen.getByTestId('icon');
      expect(icon).toBeInTheDocument();
      expect(icon.querySelector('use')).toHaveAttribute(
        'xlink:href',
        expect.stringContaining('launch'),
      );
    });

    test('does not show an icon when openNewTab is false', () => {
      render(
        <BrowserRouter>
          <TrusteeName trusteeName={TRUSTEE_NAME} trusteeId={TRUSTEE_ID} openNewTab={false} />
        </BrowserRouter>,
      );

      expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
    });

    test('opens in a new tab when openNewTab is true', () => {
      render(
        <BrowserRouter>
          <TrusteeName trusteeName={TRUSTEE_NAME} trusteeId={TRUSTEE_ID} openNewTab />
        </BrowserRouter>,
      );

      const link = screen.getByTestId('case-detail-trustee-link');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    test('does not open in a new tab when openNewTab is false', () => {
      render(
        <BrowserRouter>
          <TrusteeName trusteeName={TRUSTEE_NAME} trusteeId={TRUSTEE_ID} openNewTab={false} />
        </BrowserRouter>,
      );

      const link = screen.getByTestId('case-detail-trustee-link');
      expect(link).not.toHaveAttribute('target');
      expect(link).not.toHaveAttribute('rel');
    });
  });
});
