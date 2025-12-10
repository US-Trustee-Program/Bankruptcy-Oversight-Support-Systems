/**
 * Shared constants for mock OAuth2 authentication
 *
 * IMPORTANT: These values must stay in sync between backend mock gateway
 * and BDD test fixtures to ensure JWT tokens can be verified correctly.
 */

/**
 * Secret used for signing/verifying JWT tokens in mock authentication
 * Used by:
 * - backend/lib/testing/mock-gateways/mock-oauth2-gateway.ts (JWT signing/verification)
 * - test/bdd/fixtures/auth.fixtures.ts (JWT token creation for tests)
 */
export const MOCK_JWT_SECRET = 'mock-secret'; // pragma: allowlist secret

/**
 * Default issuer for mock OAuth2 tokens
 */
export const MOCK_ISSUER = 'http://test/oauth2/default';

/**
 * Default audience for mock OAuth2 tokens
 */
export const MOCK_AUDIENCE = 'api://default';
