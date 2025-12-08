import jwt from 'jsonwebtoken';
import { CamsSession } from '@common/cams/session';
import { CamsRole } from '@common/cams/roles';
import MockData from '@common/cams/test-utilities/mock-data';
import { nowInSeconds } from '@common/date-helper';
import { CamsJwtClaims } from '@common/cams/jwt';

/**
 * Authentication fixtures for BDD tests
 * Provides pre-configured user sessions with different roles
 */

/**
 * Create a test session with specific roles and permissions
 * IMPORTANT: Uses 'okta' provider and 'http://test/oauth2/default' issuer to match setup-tests.ts configuration
 */
export function createTestSession(roles: CamsRole[] = []): CamsSession {
  const session = MockData.getCamsSession({
    user: MockData.getCamsUser({
      id: 'test-user-id',
      name: 'Test User',
      roles,
    }),
    // Override provider and issuer to match test configuration
    provider: 'okta',
    issuer: 'http://test/oauth2/default',
  });

  // Add JWT access token for API authentication
  session.accessToken = createTestAuthToken(roles);

  return session;
}

/**
 * Create a mock JWT token for API requests
 * This creates a properly formatted JWT that matches what the backend's OAuth gateway expects
 * The audience is derived from the issuer path (e.g., 'http://test/oauth2/default' → 'api://default')
 */
export function createTestAuthToken(roles: CamsRole[] = []): string {
  const NOW = nowInSeconds();
  const ONE_DAY = 60 * 60 * 24;

  const claims: CamsJwtClaims = {
    aud: 'api://default', // Matches the audience derived from issuer path '/oauth2/default'
    sub: 'test-user-id', // Matches the user ID in createTestSession
    iss: 'http://test/oauth2/default', // Must match backend CAMS_LOGIN_PROVIDER_CONFIG issuer
    exp: NOW + ONE_DAY,
    groups: roles,
  };

  // Use the same secret as the mock OAuth2 gateway
  const mockSecret = 'mock-secret'; // pragma: allowlist secret

  return jwt.sign(claims, mockSecret);
}

/**
 * Pre-configured test user sessions
 */
export const TestSessions = {
  /**
   * Case Assignment Manager - can manage case assignments
   */
  caseAssignmentManager: (): CamsSession =>
    createTestSession([CamsRole.CaseAssignmentManager]),

  /**
   * Trial Attorney - can view cases and manage within their office
   */
  trialAttorney: (): CamsSession => createTestSession([CamsRole.TrialAttorney]),

  /**
   * Data Verifier - can verify and correct data
   */
  dataVerifier: (): CamsSession => createTestSession([CamsRole.DataVerifier]),

  /**
   * Super User - has all permissions
   */
  superUser: (): CamsSession =>
    createTestSession([
      CamsRole.CaseAssignmentManager,
      CamsRole.TrialAttorney,
      CamsRole.DataVerifier,
    ]),

  /**
   * Read-only user - can only view data
   */
  readOnlyUser: (): CamsSession => createTestSession([]),
};

/**
 * Pre-configured auth tokens corresponding to test sessions
 */
export const TestAuthTokens = {
  caseAssignmentManager: createTestAuthToken([CamsRole.CaseAssignmentManager]),
  trialAttorney: createTestAuthToken([CamsRole.TrialAttorney]),
  dataVerifier: createTestAuthToken([CamsRole.DataVerifier]),
  superUser: createTestAuthToken([
    CamsRole.CaseAssignmentManager,
    CamsRole.TrialAttorney,
    CamsRole.DataVerifier,
  ]),
  readOnlyUser: createTestAuthToken([]),
};
