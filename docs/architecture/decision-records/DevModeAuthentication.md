# Dev Mode Authentication

## Context

CAMS uses Okta for production authentication and has a legacy "mock" mode for local development that presents users with a radio button list to select pre-configured user roles. While mock mode is useful for quick testing, it has several limitations:

1. **No authentication layer**: Users simply select a role without any credentials, which doesn't reflect real-world authentication flows
1. **Fixed user list**: The available users and their roles are hardcoded in the codebase, requiring code changes to test different scenarios
1. **Not suitable for shared environments**: Mock mode cannot be used in Azure-hosted development environments where multiple developers need independent user accounts
1. **No password testing**: Developers cannot test password-based authentication flows

Additionally, we wanted to avoid:
- **Third-party hosting requirements**: Solutions like Keycloak require additional infrastructure and maintenance
- **External dependencies**: Relying on Okta for development environments creates dependencies and potential costs
- **Complex setup**: Developers should be able to configure authentication through simple environment variables

The need for a lightweight, configurable authentication solution for development environments led to the creation of "dev" mode.

## Decision

We implemented a new "dev" authentication mode with the following characteristics:

### Architecture
1. **Separate implementation**: Dev mode has completely independent gateway, session, and user group implementations (not coupled to mock mode)
1. **Username/password authentication**: Users authenticate with a standard username and password form
1. **Environment-based configuration**: User accounts are configured via the `DEV_USERS` environment variable in JSON format
1. **Secure password storage**: Passwords are hashed using scrypt (memory-hard key derivation function) with unique salts per user
1. **Flexible role assignment**: Users can be assigned any combination of CamsRole values and office locations
1. **PrivilegedIdentity mapping**: All users are automatically granted PrivilegedIdentityUser role in JWT groups for testing flexibility
1. **E2E test support**: Playwright tests can authenticate using dev mode with credentials from environment variables

### Security Implementation
- **Hash format**: `scrypt$<base64-salt>$<base64-hash>`
- **Salt generation**: 16-byte random salt per password
- **Key derivation**: 64-byte scrypt-derived key
- **Timing-safe comparison**: Uses `crypto.timingSafeEqual` to prevent timing attacks
- **Password utility**: `tsx ops/scripts/generate-dev-password-hash.ts` script for offline hash generation

### Configuration Example
```bash
# Backend .env
CAMS_LOGIN_PROVIDER=dev
DEV_USERS='[{
  "username":"alice",
  "passwordHash":"scrypt$aGVsbG93b3JsZA==$ZGF0YWhlcmU...",  # pragma: allowlist secret
  "name":"Alice Attorney",
  "roles":["TrialAttorney","PrivilegedIdentityUser"],
  "offices":["USTP_CAMS_Region_2_Office_Manhattan"]
}]'

# Frontend .env
CAMS_LOGIN_PROVIDER=dev

# E2E Test .env
CAMS_LOGIN_PROVIDER=dev
DEV_TEST_USERNAME=alice
DEV_TEST_PASSWORD=plaintext_password
```

### Implementation Components
- **Backend**: `dev-oauth2-gateway.ts`, `dev-user-session-use-case.ts`, `dev-user-group-gateway.ts`
- **Frontend**: `DevLogin.tsx` component with username/password form
- **E2E**: Extended `auth-setup.ts` with dev mode login flow
- **Utility**: `generate-dev-password-hash.ts` script

## Status

Accepted

## Consequences

### Positive
1. **Flexible development**: Developers can configure custom users with specific roles and offices without code changes
1. **Azure-compatible**: Can be used in Azure-hosted development environments with credentials stored in Application Settings
1. **No external dependencies**: Does not require Keycloak, additional Okta instances, or other third-party services
1. **Secure**: Passwords are hashed and salted, never stored in plain text
1. **E2E testable**: Full support for automated testing with configurable test credentials
1. **Production-like flows**: Tests actual authentication flow with username/password instead of mock selection
1. **Independent implementation**: Clean separation from mock mode allows both to coexist and be maintained separately

### Negative
1. **Not for production**: Dev mode is explicitly for development and test environments only
1. **Manual hash generation**: Developers must use the utility script to generate password hashes (intentional security trade-off)
1. **Environment variable size**: JSON configuration in environment variables can become large with many users
1. **Additional maintenance**: Three authentication modes (okta, mock, dev) require more maintenance than two

### Security Considerations
- **Never commit DEV_USERS to git**: Should be stored in Azure Application Settings or local .env (gitignored)
- **Use strong passwords**: Even for development environments, use passwords with sufficient entropy
- **Rotate credentials**: Development environment credentials should be rotated periodically
- **Limit access**: Restrict access to .env files and Azure Application Settings containing DEV_USERS

### Migration Path
- Mock mode remains available for quick local testing
- Dev mode can be adopted incrementally by teams that need more realistic authentication
- Okta remains the only production authentication method
- Future: Mock mode may be deprecated if dev mode proves sufficient for all development use cases

### Usage Recommendation
- **Mock mode**: Quick local testing, no authentication needed
- **Dev mode**: Shared development environments, testing authentication flows, E2E tests
- **Okta mode**: Production, staging, and environments requiring real DOJ user accounts
