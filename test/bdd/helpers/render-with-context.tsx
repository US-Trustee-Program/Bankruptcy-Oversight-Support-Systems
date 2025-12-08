import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LocalStorage from '@/lib/utils/local-storage';
import { CamsSession } from '@common/cams/session';
import { TestSessions } from '../fixtures/auth.fixtures';
import App from '@/App';
import { AuthenticationRoutes } from '@/login/AuthenticationRoutes';

/**
 * Custom render options for BDD tests
 */
interface BddRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Initial route for MemoryRouter
   */
  initialRoute: string;

  /**
   * User session to set in LocalStorage
   * Defaults to a Case Assignment Manager session
   */
  session?: CamsSession;
}

/**
 * Render the full App with necessary setup for BDD tests
 *
 * This helper:
 * - Renders the complete App.tsx with all its real dependencies
 * - Sets up routing with MemoryRouter at the specified route
 * - Configures user session in LocalStorage
 * - Lets App provide all its own context (GlobalAlert, AppInsights, LaunchDarkly, etc.)
 *
 * @example
 * ```typescript
 * const { getByText } = renderApp({
 *   initialRoute: '/case-detail/081-23-12345',
 *   session: TestSessions.caseAssignmentManager(),
 * });
 * ```
 */
export function renderApp(options: BddRenderOptions) {
  const { initialRoute, session = TestSessions.caseAssignmentManager(), ...renderOptions } =
    options;

  // Setup LocalStorage session before rendering
  // Login component will check this and render Session wrapper
  LocalStorage.setSession(session);
  // Also set the AuthorizedUseOnly acknowledgement
  LocalStorage.setAck(true);

  // Note: window.CAMS_CONFIGURATION is set globally in setup-tests.ts
  // at module load time to ensure API client captures correct baseUrl

  // Render the full App wrapped in MemoryRouter and AuthenticationRoutes
  // This matches the production structure: Router > AuthenticationRoutes > App
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthenticationRoutes>
        <App />
      </AuthenticationRoutes>
    </MemoryRouter>,
    renderOptions,
  );
}
