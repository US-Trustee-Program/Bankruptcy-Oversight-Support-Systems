/**
 * JWT Test Helpers
 *
 * Utilities for testing JWT tokens without comparing base64 strings directly.
 * Security scanners may flag hardcoded JWT tokens, so these helpers allow
 * tests to decode and verify JWT payloads instead of comparing raw tokens.
 */

interface JWTPayload {
  iss?: string;
  sub?: string;
  aud?: string;
  exp?: number;
  groups?: string[];
  [key: string]: unknown;
}

/**
 * Decode a JWT token and return the payload
 * @param token - The JWT token string
 * @returns The decoded payload object
 */
export function decodeJWTPayload(token: string): JWTPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT token format');
  }

  const payload = parts[1];
  const decoded = atob(payload);
  return JSON.parse(decoded);
}

/**
 * Verify that a JWT payload matches expected values
 * @param token - The JWT token string
 * @param expectedPayload - Expected payload values to verify
 * @returns true if all expected values match
 */
export function verifyJWTPayload(token: string, expectedPayload: Partial<JWTPayload>): boolean {
  const payload = decodeJWTPayload(token);

  for (const [key, expectedValue] of Object.entries(expectedPayload)) {
    if (JSON.stringify(payload[key]) !== JSON.stringify(expectedValue)) {
      return false;
    }
  }

  return true;
}

/**
 * Create a matcher function for vitest/jest to verify JWT payloads
 * Usage: expect(token).toEqual(expect.objectContaining(matchJWTPayload({ sub: 'user@fake.com' })))
 */
export function matchJWTPayload(expectedPayload: Partial<JWTPayload>) {
  return {
    asymmetricMatch: (actual: string) => {
      try {
        return verifyJWTPayload(actual, expectedPayload);
      } catch {
        return false;
      }
    },
    toString: () => `JWT with payload matching ${JSON.stringify(expectedPayload)}`,
  };
}
