import { describe, expect, test } from 'vitest';
import { decodeJWTPayload, verifyJWTPayload, matchJWTPayload } from './jwt-test-helpers';

describe('JWT Test Helpers', () => {
  // Generate a test JWT at runtime (same approach as Login.tsx)
  const generateTestJWT = () => {
    const header = { typ: 'JWT', alg: 'HS256' };
    const payload = {
      iss: 'http://fake.issuer.com/oauth2/default',
      sub: 'user@fake.com',
      aud: 'fakeApi',
      exp: 1765908518,
      groups: [],
    };
    const signature = '==REDACTED==';

    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(payload));

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  };

  const testJWT = generateTestJWT();

  describe('decodeJWTPayload', () => {
    test('should decode JWT payload correctly', () => {
      const payload = decodeJWTPayload(testJWT);

      expect(payload.iss).toBe('http://fake.issuer.com/oauth2/default');
      expect(payload.sub).toBe('user@fake.com');
      expect(payload.aud).toBe('fakeApi');
      expect(payload.exp).toBe(1765908518);
      expect(payload.groups).toEqual([]);
    });

    test('should throw error for invalid JWT format', () => {
      expect(() => decodeJWTPayload('invalid-token')).toThrow('Invalid JWT token format');
    });
  });

  describe('verifyJWTPayload', () => {
    test('should verify JWT payload matches expected values', () => {
      const result = verifyJWTPayload(testJWT, {
        sub: 'user@fake.com',
        aud: 'fakeApi',
      });

      expect(result).toBe(true);
    });

    test('should return false when payload does not match', () => {
      const result = verifyJWTPayload(testJWT, {
        sub: 'different@user.com',
      });

      expect(result).toBe(false);
    });

    test('should verify empty groups array', () => {
      const result = verifyJWTPayload(testJWT, {
        groups: [],
      });

      expect(result).toBe(true);
    });
  });

  describe('matchJWTPayload', () => {
    test('should match JWT payload using asymmetric matcher', () => {
      const matcher = matchJWTPayload({ sub: 'user@fake.com' });

      expect(matcher.asymmetricMatch(testJWT)).toBe(true);
    });

    test('should not match when payload differs', () => {
      const matcher = matchJWTPayload({ sub: 'wrong@user.com' });

      expect(matcher.asymmetricMatch(testJWT)).toBe(false);
    });

    test('should return false for invalid JWT', () => {
      const matcher = matchJWTPayload({ sub: 'user@fake.com' });

      expect(matcher.asymmetricMatch('invalid-token')).toBe(false);
    });
  });
});
