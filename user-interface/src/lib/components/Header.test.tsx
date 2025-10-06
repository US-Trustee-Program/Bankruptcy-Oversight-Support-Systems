import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { Header, menuNeedsAdmin } from './Header';
import * as FeatureFlags from '@/lib/hooks/UseFeatureFlags';
import LocalStorage from '../utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsRole } from '@common/cams/roles';
import userEvent from '@testing-library/user-event';
import { PRIVILEGED_IDENTITY_MANAGEMENT } from '@/lib/hooks/UseFeatureFlags';
import { FeatureFlagSet } from '@common/feature-flags';
import { CamsSession } from '@common/cams/session';

describe('Header', () => {
  const uiUser = userEvent.setup();
  const user = MockData.getCamsUser({
    roles: [CamsRole.CaseAssignmentManager, CamsRole.DataVerifier],
  });
  vi.spyOn(FeatureFlags, 'default').mockReturnValue({
    'transfer-orders-enabled': true,
  });

  beforeEach(() => {
    LocalStorage.setSession(MockData.getCamsSession({ user }));
  });

  function renderWithoutProps() {
    render(
      <React.StrictMode>
        <BrowserRouter>
          <Header />
        </BrowserRouter>
      </React.StrictMode>,
    );
  }

  function renderWithHistory(url: string) {
    render(
      <MemoryRouter initialEntries={[url]}>
        <Header />
      </MemoryRouter>,
    );
  }

  test('should be rendered', async () => {
    renderWithoutProps();
    const mainTitle = await screen.findByText('U.S. Trustee Program');
    const subTitle = await screen.findByText('Case Management System (CAMS)');
    const staffAssignmentMenu = await screen.findByTestId('header-staff-assignment-link');

    expect(mainTitle).toBeInTheDocument();
    expect(subTitle).toBeInTheDocument();
    expect(staffAssignmentMenu).toBeInTheDocument();
  });

  const highlightTestCases = [
    ['my cases', '/my-cases', 'header-my-cases-link'],
    ['staff assignment', '/staff-assignment', 'header-staff-assignment-link'],
    ['data verification', '/data-verification', 'header-data-verification-link'],
    ['search', '/search', 'header-search-link'],
  ];
  test.each(highlightTestCases)(
    'should highlight the %s link',
    async (_caseName: string, url: string, linkTestId: string) => {
      renderWithHistory(url);

      const link = await screen.findByTestId(linkTestId);
      expect(link).toBeInTheDocument();
      await waitFor(() => {
        expect(link).toHaveClass('usa-current current');
      });

      const current = document.querySelectorAll('.usa-current.current');
      expect(current).toHaveLength(1);
    },
  );

  test('should not highlight any link when URL is /gibberish', async () => {
    renderWithHistory('/gibberish');

    const current = document.querySelectorAll('.usa-current .current');
    expect(current).toHaveLength(0);
  });

  const linkTestIds = [
    ['header-staff-assignment-link'],
    ['header-data-verification-link'],
    ['header-my-cases-link'],
    ['header-search-link'],
  ];
  test.each(linkTestIds)('should activate %s link when clicked', async (linkTestId: string) => {
    renderWithoutProps();

    let linkToClick = await screen.findByTestId(linkTestId);
    await uiUser.click(linkToClick);

    linkToClick = await screen.findByTestId(linkTestId);
    expect(linkToClick).toHaveClass('usa-current current');

    const current = document.querySelectorAll('.usa-current.current');
    expect(current).toHaveLength(1);
  });

  test.each(linkTestIds)(
    'should activate %s link when space bar is pressed',
    async (linkTestId: string) => {
      renderWithoutProps();

      let link = await screen.findByTestId(linkTestId);
      await uiUser.type(link, ' ');

      await waitFor(async () => {
        link = await screen.findByTestId(linkTestId);
        expect(link).toHaveClass('usa-current current');
      });

      const current = document.querySelectorAll('.usa-current.current');
      expect(current).toHaveLength(1);
    },
  );

  test('should not display data verification link when unauthorized', () => {
    const unauthorizedUser = MockData.getCamsUser({ roles: [CamsRole.CaseAssignmentManager] });
    LocalStorage.setSession(MockData.getCamsSession({ user: unauthorizedUser }));
    renderWithoutProps();

    const link = screen.queryByTestId('header-data-verification-link');
    expect(link).not.toBeInTheDocument();
  });

  test('should display data verification link when authorized', async () => {
    renderWithoutProps();

    const link = screen.queryByTestId('header-data-verification-link');
    expect(link).toBeInTheDocument();
  });

  describe('Trustee navigation role-based access control', () => {
    test('should not display trustees link when user lacks TrusteeAdmin role', () => {
      // Current user has CaseAssignmentManager and DataVerifier but not TrusteeAdmin
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        'transfer-orders-enabled': true,
        'trustee-management': true, // Feature flag enabled
      });

      renderWithoutProps();

      const link = screen.queryByTestId('header-trustees-link');
      expect(link).not.toBeInTheDocument();
    });

    test('should not display trustees link when feature flag is disabled', () => {
      const trusteeAdminUser = MockData.getCamsUser({ roles: [CamsRole.TrusteeAdmin] });
      LocalStorage.setSession(MockData.getCamsSession({ user: trusteeAdminUser }));

      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        'transfer-orders-enabled': true,
        'trustee-management': false, // Feature flag disabled
      });

      renderWithoutProps();

      const link = screen.queryByTestId('header-trustees-link');
      expect(link).not.toBeInTheDocument();
    });

    test('should display trustees link when user has TrusteeAdmin role and feature flag is enabled', () => {
      const trusteeAdminUser = MockData.getCamsUser({ roles: [CamsRole.TrusteeAdmin] });
      LocalStorage.setSession(MockData.getCamsSession({ user: trusteeAdminUser }));

      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        'transfer-orders-enabled': true,
        'trustee-management': true, // Feature flag enabled
      });

      renderWithoutProps();

      const link = screen.queryByTestId('header-trustees-link');
      expect(link).toBeInTheDocument();
    });

    test('should not display trustees link when both role and feature flag requirements fail', () => {
      // User without TrusteeAdmin role and feature flag disabled
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        'transfer-orders-enabled': true,
        'trustee-management': false,
      });

      renderWithoutProps();

      const link = screen.queryByTestId('header-trustees-link');
      expect(link).not.toBeInTheDocument();
    });

    test('should highlight trustees link when on trustees page', async () => {
      const trusteeAdminUser = MockData.getCamsUser({ roles: [CamsRole.TrusteeAdmin] });
      LocalStorage.setSession(MockData.getCamsSession({ user: trusteeAdminUser }));

      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        'transfer-orders-enabled': true,
        'trustee-management': true,
      });

      renderWithHistory('/trustees');

      const link = await screen.findByTestId('header-trustees-link');
      expect(link).toBeInTheDocument();
      await waitFor(() => {
        expect(link).toHaveClass('usa-current current');
      });

      const current = document.querySelectorAll('.usa-current.current');
      expect(current).toHaveLength(1);
    });
  });

  describe('menuNeedsAdmin', () => {
    const superUser: CamsSession = MockData.getCamsSession({
      user: MockData.getCamsUser({ roles: [CamsRole.SuperUser] }),
    });

    const caseMgr: CamsSession = MockData.getCamsSession({
      user: MockData.getCamsUser({ roles: [CamsRole.CaseAssignmentManager] }),
    });

    // Clean up any modifications to userMenuItems between tests
    beforeEach(() => {
      // Reset LocalStorage session for each test
      LocalStorage.setSession(MockData.getCamsSession({ user: MockData.getCamsUser() }));

      // Reset feature flags
      vi.spyOn(FeatureFlags, 'default').mockReturnValue({
        'transfer-orders-enabled': true,
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    type Row = [string, CamsSession | null, boolean];
    const rows: Row[] = [
      ['all conditions met', superUser, true],
      ['session = null', null, false],
      ['no superuser role', caseMgr, false],
      ['no roles', MockData.getCamsSession({ user: MockData.getCamsUser({ roles: [] }) }), false],
      [
        'roles = undefined',
        MockData.getCamsSession({ user: { ...MockData.getCamsUser(), roles: undefined } }),
        false,
      ],
      [
        'multiple roles including superuser',
        MockData.getCamsSession({
          user: MockData.getCamsUser({
            roles: [CamsRole.CaseAssignmentManager, CamsRole.SuperUser, CamsRole.DataVerifier],
          }),
        }),
        true,
      ],
    ];

    test.each(rows)('%s', (_name, session, expected) => {
      expect(menuNeedsAdmin(session)).toBe(expected);
    });

    test('should return false when userMenuItems already contains Admin item', () => {
      // This test simulates the scenario where the Header component has already been rendered
      // and the Admin item has been added to userMenuItems

      const session: CamsSession = MockData.getCamsSession({
        user: MockData.getCamsUser({ roles: [CamsRole.SuperUser] }),
      });
      const flags: FeatureFlagSet = {
        [PRIVILEGED_IDENTITY_MANAGEMENT]: true,
      };

      // First, verify that menuNeedsAdmin returns true initially
      const initialResult = menuNeedsAdmin(session);
      expect(initialResult).toBe(true);

      // Mock LocalStorage to return the session with SuperUser role
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(session);

      // Mock feature flags to enable PRIVILEGED_IDENTITY_MANAGEMENT
      vi.spyOn(FeatureFlags, 'default').mockReturnValue(flags);

      // Render the Header component which will call menuNeedsAdmin and add Admin to userMenuItems
      render(
        <React.StrictMode>
          <BrowserRouter>
            <Header />
          </BrowserRouter>
        </React.StrictMode>,
      );

      // Now call menuNeedsAdmin again - it should return false because Admin item is now present
      const resultAfterRender = menuNeedsAdmin(session);
      expect(resultAfterRender).toBe(false);
    });
  });
});
