import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderApp } from '../../helpers/render-with-context';
import { initializeTestServer, cleanupTestServer } from '../../helpers/api-server';
import { TestSessions } from '../../fixtures/auth.fixtures';
import { clearAllRepositorySpies, spyOnMeEndpoint } from '../../helpers/repository-spies';
import LocalStorage from '@/lib/utils/local-storage.ts';
import { MOCK_ISSUER } from '../../../../backend/lib/testing/mock-gateways/mock-oauth2-constants';

// Mock database drivers (same as functional tests)
import '../../helpers/driver-mocks';

/**
 * BDD Environment Diagnostics
 *
 * This test suite validates that the BDD full-stack testing environment is configured correctly.
 * Run these tests independently to diagnose issues with:
 * - Configuration parsing (frontend and backend)
 * - Session validation
 * - Authentication flow
 * - API endpoint connectivity
 *
 * Usage: npm test -- bdd-environment.spec.tsx
 */
describe('BDD Environment Diagnostics', () => {
  beforeAll(async () => {
    await initializeTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer();
    clearAllRepositorySpies();
  });

  beforeEach(async () => {
    clearAllRepositorySpies();
    await spyOnMeEndpoint(TestSessions.caseAssignmentManager());
  });

  /**
   * Diagnostic: Configuration Parsing
   *
   * Verifies that:
   * - CAMS_LOGIN_PROVIDER_CONFIG is parsed correctly (pipe-delimited format)
   * - getAuthIssuer() returns the expected issuer
   * - Session issuer matches configuration issuer
   */
  it('should correctly parse frontend configuration', async () => {
    const session = TestSessions.caseAssignmentManager();

    console.log('[DIAGNOSTIC] Session issuer:', session.issuer);
    console.log('[DIAGNOSTIC] Session provider:', session.provider);

    console.log('[DIAGNOSTIC] Raw frontend config:');
    console.log('  - CAMS_LOGIN_PROVIDER:', window.CAMS_CONFIGURATION.CAMS_LOGIN_PROVIDER);
    console.log(
      '  - CAMS_LOGIN_PROVIDER_CONFIG:',
      window.CAMS_CONFIGURATION.CAMS_LOGIN_PROVIDER_CONFIG,
    );

    // Import the login library functions to test them directly
    const { getAuthIssuer, getLoginConfiguration } = await import('@/login/login-library');

    console.log('[DIAGNOSTIC] Calling getLoginConfiguration():');
    const loginConfig = getLoginConfiguration();
    console.log('  - Result:', loginConfig);
    console.log('  - Type:', typeof loginConfig);

    console.log('[DIAGNOSTIC] Calling getAuthIssuer():');
    const issuer = getAuthIssuer();
    console.log('  - Result:', issuer);
    console.log('  - Type:', typeof issuer);

    console.log('[DIAGNOSTIC] Comparison:');
    console.log('  - session.issuer:', session.issuer);
    console.log('  - getAuthIssuer():', issuer);
    console.log('  - Match:', issuer === session.issuer);

    // Assert that configuration is parsed correctly
    expect(loginConfig).toHaveProperty('issuer', MOCK_ISSUER);
    expect(issuer).toBe(MOCK_ISSUER);
    expect(issuer).toBe(session.issuer);
  });

  /**
   * Diagnostic: Session Validation
   *
   * Verifies that:
   * - Session is stored in LocalStorage before render
   * - Session persists after render (not cleared by validation)
   * - Session provider and issuer match configuration
   */
  it('should preserve session through render', async () => {
    const session = TestSessions.caseAssignmentManager();

    console.log('[DIAGNOSTIC] Session before render:');
    console.log('  - provider:', session.provider);
    console.log('  - issuer:', session.issuer);
    console.log('  - expires:', session.expires);
    console.log('  - user.id:', session.user.id);

    renderApp({
      initialRoute: '/',
      session,
    });

    // Check LocalStorage after render
    const storedSession = LocalStorage.getSession();
    console.log('[DIAGNOSTIC] Session after render:', storedSession ? 'EXISTS' : 'NULL');
    if (storedSession) {
      console.log('  - provider:', storedSession.provider);
      console.log('  - issuer:', storedSession.issuer);
    }

    // Assert session is preserved
    expect(storedSession).not.toBeNull();
    expect(storedSession?.provider).toBe('okta');
    expect(storedSession?.issuer).toBe(MOCK_ISSUER);
  });

  /**
   * Diagnostic: Backend /me Endpoint
   *
   * Verifies that:
   * - /me endpoint is accessible
   * - Backend Okta configuration is correct
   * - Gateway spy is working correctly
   * - Returns valid user data
   */
  it('should successfully call /me endpoint', async () => {
    const session = TestSessions.caseAssignmentManager();

    console.log('[DIAGNOSTIC] Testing /me endpoint:');
    console.log('  - Session user:', session.user.name);
    console.log('  - Access token:', session.accessToken?.substring(0, 20) + '...');

    try {
      const response = await fetch('http://localhost:4000/api/me', {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      console.log('  - Response status:', response.status);

      if (response.ok) {
        const responseData = await response.json();
        console.log('  - Response data:', JSON.stringify(responseData, null, 2));

        // Assert successful response
        expect(response.status).toBe(200);
        expect(responseData).toHaveProperty('data');
        expect(responseData.data).toHaveProperty('user');
        expect(responseData.data.user).toHaveProperty('name');
      } else {
        const error = await response.json();
        console.log('  - Error response:', JSON.stringify(error, null, 2));
        throw new Error(`/me endpoint failed with status ${response.status}`);
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.log('  - Exception:', error.message);
      throw err;
    }
  });

  /**
   * Diagnostic: Backend Configuration
   *
   * Verifies that backend environment variables are set correctly
   */
  it('should have correct backend environment variables', () => {
    console.log('[DIAGNOSTIC] Backend environment variables:');
    console.log('  - CAMS_LOGIN_PROVIDER:', process.env.CAMS_LOGIN_PROVIDER);
    console.log('  - CAMS_LOGIN_PROVIDER_CONFIG:', process.env.CAMS_LOGIN_PROVIDER_CONFIG);
    console.log('  - CAMS_USER_GROUP_GATEWAY_CONFIG:', process.env.CAMS_USER_GROUP_GATEWAY_CONFIG);
    console.log('  - MONGO_CONNECTION_STRING:', process.env.MONGO_CONNECTION_STRING);

    // Assert backend config
    expect(process.env.CAMS_LOGIN_PROVIDER).toBe('okta');
    expect(process.env.CAMS_LOGIN_PROVIDER_CONFIG).toBeDefined();
    expect(process.env.CAMS_LOGIN_PROVIDER_CONFIG).toContain(`issuer=${MOCK_ISSUER}`);
    expect(process.env.CAMS_USER_GROUP_GATEWAY_CONFIG).toBeDefined();
    expect(process.env.CAMS_USER_GROUP_GATEWAY_CONFIG).toContain('clientId=test-client-id');
  });

  /**
   * Diagnostic: Full Authentication Flow
   *
   * Verifies the complete flow:
   * - Session storage
   * - App rendering
   * - Session validation
   * - /me endpoint call
   * - App shows authenticated content
   */
  it('should complete full authentication flow', async () => {
    const session = TestSessions.caseAssignmentManager();

    console.log('[DIAGNOSTIC] Starting full authentication flow');

    // Import login-library functions
    const { getAuthIssuer } = await import('@/login/login-library');

    // Step 1: Verify configuration
    const issuer = getAuthIssuer();
    console.log('  [1] Configuration issuer:', issuer);
    expect(issuer).toBe(MOCK_ISSUER);

    // Step 2: Render app with session
    renderApp({
      initialRoute: '/',
      session,
    });
    console.log('  [2] App rendered');

    // Step 3: Verify session persisted
    const storedSession = LocalStorage.getSession();
    console.log('  [3] Session stored:', storedSession ? 'YES' : 'NO');
    expect(storedSession).not.toBeNull();

    // Step 4: Verify /me endpoint works
    const response = await fetch('http://localhost:4000/api/me', {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    console.log('  [4] /me endpoint status:', response.status);
    expect(response.ok).toBe(true);

    // Step 5: Wait for app to finish loading
    await waitFor(
      () => {
        const body = document.body.textContent || '';
        console.log('  [5] Checking rendered content...');

        // Should not be stuck on "Loading session..."
        if (body.includes('Loading session...')) {
          console.log('     - Still loading...');
          throw new Error('Still loading');
        }

        // Should show app content (header, navigation, etc)
        const hasContent = body.length > 100;
        console.log('     - Has content:', hasContent);
        expect(hasContent).toBe(true);
      },
      { timeout: 5000, interval: 500 },
    );

    console.log('[DIAGNOSTIC] ✓ Full authentication flow completed successfully');
  });
});
