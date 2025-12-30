import jwt from 'jsonwebtoken';
import { CamsSession } from '@common/cams/session';
import { CamsRole } from '@common/cams/roles';
import MockData from '@common/cams/test-utilities/mock-data';
import DateHelper from '@common/date-helper';
import { CamsJwtClaims } from '@common/cams/jwt';
import {
  MOCK_JWT_JOHN_HANCOCK,
  MOCK_ISSUER,
  MOCK_AUDIENCE,
} from '@backend/lib/testing/mock-gateways/mock-oauth2-constants.ts';

const { nowInSeconds } = DateHelper;

/**
 * Authentication fixtures for BDD tests
 * Provides pre-configured user sessions with different roles
 */

/**
 * Create a test session with specific roles and permissions
 * IMPORTANT: Uses 'okta' provider and MOCK_ISSUER to match setup-tests.ts configuration
 */
export function createTestSession(roles: CamsRole[] = [], expiryInSeconds?: number): CamsSession {
  const NOW = nowInSeconds();
  const ONE_DAY = 60 * 60 * 24;

  const session = MockData.getCamsSession({
    user: MockData.getCamsUser({
      id: 'test-user-id',
      name: 'Test User',
      roles,
    }),
    // Override provider and issuer to match test configuration
    provider: 'okta',
    issuer: MOCK_ISSUER,
  });

  // Add JWT access token for API authentication
  session.accessToken = createTestAuthToken(roles, expiryInSeconds);
  session.expires = expiryInSeconds ?? NOW + ONE_DAY;

  return session;
}

/**
 * Create a mock JWT token for API requests
 * This creates a properly formatted JWT that matches what the backend's OAuth gateway expects
 * The audience is derived from the issuer path (e.g., MOCK_ISSUER → MOCK_AUDIENCE)
 * @param roles - Array of CamsRole for the user
 * @param expiryInSeconds - Optional custom expiry timestamp in seconds (Unix epoch). If not provided, defaults to NOW + ONE_DAY
 */
export function createTestAuthToken(roles: CamsRole[] = [], expiryInSeconds?: number): string {
  const NOW = nowInSeconds();
  const ONE_DAY = 60 * 60 * 24;

  const claims: CamsJwtClaims = {
    aud: MOCK_AUDIENCE, // Matches the audience derived from issuer path '/oauth2/default'
    sub: 'test-user-id', // Matches the user ID in createTestSession
    iss: MOCK_ISSUER, // Must match backend CAMS_LOGIN_PROVIDER_CONFIG issuer
    exp: expiryInSeconds ?? NOW + ONE_DAY,
    groups: roles,
  };

  // Use the shared mock JWT secret (defined in mock-oauth2-constants.ts)
  return jwt.sign(claims, MOCK_JWT_JOHN_HANCOCK);
}

/**
 * Pre-configured test user sessions
 */
export const TestSessions = {
  /**
   * Case Assignment Manager - can manage case assignments
   */
  caseAssignmentManager: (): CamsSession => createTestSession([CamsRole.CaseAssignmentManager]),

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

  /**
   * Trustee Admin - can manage trustees and their information
   */
  trusteeAdmin: (): CamsSession => createTestSession([CamsRole.TrusteeAdmin]),
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
  trusteeAdmin: createTestAuthToken([CamsRole.TrusteeAdmin]),
};
