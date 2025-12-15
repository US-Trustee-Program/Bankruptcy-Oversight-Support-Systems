import { beforeAll } from 'vitest';
import '@testing-library/jest-dom';
import { MOCK_ISSUER } from '../../../backend/lib/testing/mock-gateways/mock-oauth2-constants';

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
global.console = {
  ...console,
  // Suppress console output during tests (optional)
  // log: vi.fn(),
  // debug: vi.fn(),
  // info: vi.fn(),
  // warn: vi.fn(),
  // error: vi.fn(),
};
