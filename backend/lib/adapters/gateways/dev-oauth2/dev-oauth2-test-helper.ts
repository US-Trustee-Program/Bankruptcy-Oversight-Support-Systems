/**
 * Test helper utilities for dev-oauth2 tests.
 * Contains shared test fixtures and constants.
 */

/**
 * Mock scrypt hash value for testing authentication.
 * Format: scrypt$<base64-salt>$<base64-hash>
 * This is a test fixture and not a real credential.
 */
export const MOCK_SCRYPT_HASH =
  'scrypt$dGVzdHNhbHQxMjM0NTY=$bW9ja2hhc2g5ODc2NTQzMjEwYWJjZGVmZ2hpamts'; // pragma: allowlist secret
