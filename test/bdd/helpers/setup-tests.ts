import { beforeAll, vi } from 'vitest';
import '@testing-library/jest-dom';
import { MOCK_ISSUER } from '@backend/lib/testing/mock-gateways/mock-oauth2-constants.ts';

// Mock Node.js-specific phonetic packages that can't run in jsdom environment
// These are already tested in backend unit tests (phonetic-utils.test.ts)
// For BDD tests, we mock at the repository level with pre-computed tokens
vi.mock('../../../backend/lib/use-cases/cases/phonetic-utils', () => ({
  generatePhoneticTokens: vi.fn((text: string) => {
    // Simple mock that returns consistent tokens for testing
    if (!text) return [];
    return [text.substring(0, 4).toUpperCase()];
  }),
  expandQueryWithNicknames: vi.fn((query: string) => {
    // Simple mock - just return the original query
    return [query];
  }),
  generatePhoneticTokensWithNicknames: vi.fn((text: string) => {
    if (!text) return [];
    return [text.substring(0, 4).toUpperCase()];
  }),
  calculateJaroWinklerSimilarity: vi.fn(() => 0.9), // Always high similarity for tests
  filterCasesByDebtorNameSimilarity: vi.fn((cases) => cases), // Pass through
  isPhoneticSearchEnabled: vi.fn(() => true),
}));

// Setup window configuration for React app AT MODULE LOAD TIME
// This must happen BEFORE any UI modules are imported
// because api.ts captures baseUrl at module load time
window.CAMS_CONFIGURATION = {
  CAMS_USE_FAKE_API: 'false', // We use real API calls to our test server
  CAMS_LOGIN_PROVIDER: 'okta', // Use okta provider to match production flow
  // IMPORTANT: Config format is pipe-separated key=value pairs (NOT JSON!)
  // Format: key1=value1|key2=value2|key3=value3
  // Issuer must match the test JWT issuer and have a path for audience derivation
  CAMS_LOGIN_PROVIDER_CONFIG: `issuer=${MOCK_ISSUER}|clientId=test-client-id|redirectUri=http://localhost:4000/login-callback`,
  CAMS_APPLICATIONINSIGHTS_CONNECTION_STRING: '',
  CAMS_DISABLE_LOCAL_CACHE: 'true', // Disable caching in tests
  CAMS_FEATURE_FLAG_CLIENT_ID: 'test-client-id', // Enable feature flag mocking via withFeatureFlag()
  // Point API client to test server on port 4000
  CAMS_BASE_PATH: '/api',
  CAMS_SERVER_HOSTNAME: 'localhost',
  CAMS_SERVER_PORT: '4000',
  CAMS_SERVER_PROTOCOL: 'http',
};

// Setup environment variables for testing
beforeAll(() => {
  // Mock environment - use fake APIs but mock drivers at connection level
  process.env.CAMS_USE_FAKE_API = 'false'; // We want real API calls to our test server
  process.env.CAMS_LOGIN_PROVIDER = 'okta'; // Use okta authentication to match frontend
  // Okta configuration for backend authentication (issuer for JWT validation)
  // Must match frontend issuer and include path for audience derivation
  process.env.CAMS_LOGIN_PROVIDER_CONFIG = `issuer=${MOCK_ISSUER}`;
  // Okta configuration for user group gateway (clientId, privateKey, etc.)
  // Using minimal test values - these will be mocked at the gateway layer
  process.env.CAMS_USER_GROUP_GATEWAY_CONFIG =
    'clientId=test-client-id|keyId=test-key-id|url=http://test|privateKey={"kty":"RSA","n":"test","e":"AQAB"}';
  process.env.OKTA_API_KEY = 'test-api-key'; // pragma: allowlist secret
  // NOTE: We do NOT set DATABASE_MOCK='true' - we mock drivers instead
  process.env.MONGO_CONNECTION_STRING = 'mongodb://test-mock'; // Still need a connection string for config
  process.env.FEATURE_FLAG_SDK_KEY = '';
  process.env.NODE_ENV = 'test';
});

// Cleanup is automatically handled by vitest

// Global test utilities
// Conditionally suppress console output during tests based on environment variable
const shouldEnableConsoleLogging = process.env.ENABLE_CONSOLE_LOGGING === 'true';

if (!shouldEnableConsoleLogging) {
  global.console = {
    ...console,
    // Suppress console output during tests (default behavior)
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}
