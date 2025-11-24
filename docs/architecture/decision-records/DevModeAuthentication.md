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
1. **Dual-source configuration**: User accounts can be configured via two methods:
   - **JSON file** (`backend/dev-users.json`): Gitignored for local development, deployed from Key Vault for cloud environments
   - **MongoDB database** (`dev-users` database, `users` collection): Automatic fallback when JSON file is unavailable
1. **Secure password storage**: Passwords are hashed using scrypt (memory-hard key derivation function) with unique salts per user
1. **Flexible role assignment**: Users can be assigned any combination of CamsRole values and office locations
1. **PrivilegedIdentity mapping**: All users are automatically granted PrivilegedIdentityUser role in JWT groups for testing flexibility
1. **E2E test support**: Playwright tests can authenticate using dev mode with credentials from environment variables

### Security Implementation
- **Hash format**: `scrypt$<base64-salt>$<base64-hash>`
- **Salt generation**: 16-byte random salt per password
- **Key derivation**: 64-byte scrypt-derived key
- **Timing-safe comparison**: Uses `crypto.timingSafeEqual` to prevent timing attacks
- **Password utility**: `tsx scripts/generate-dev-password-hash.ts` script for offline hash generation

### MongoDB Fallback Mechanism
When the `dev-users.json` file is not available, the system automatically falls back to loading users from MongoDB:

**Fallback Order**:
1. First attempts to load from `backend/dev-users.json` file
2. If file not found or contains invalid JSON, attempts MongoDB connection
3. If MongoDB unavailable or connection fails, uses empty user database (graceful degradation)

**MongoDB Configuration**:
- **Database name**: `dev-users`
- **Collection name**: `users`
- **Connection**: Uses existing `MONGO_CONNECTION_STRING` environment variable
- **Schema**: Identical to JSON file format (username, passwordHash, name, roles, offices)
- **Provisioning**: Automatically deployed via Bicep (`cosmos-dev-users-database.bicep`)
- **Indexing**: Unique index on `username` field, hash sharding for performance

**Benefits**:
- Shared dev environments can use centralized user database
- No file deployment needed in certain Azure environments
- Consistent user database across multiple instances
- Easier credential rotation without redeploying files

### Configuration Example

**Option 1: JSON File (Local Development)**
```bash
# Backend .env
CAMS_LOGIN_PROVIDER=dev

# Frontend .env
CAMS_LOGIN_PROVIDER=dev

# E2E Test .env
CAMS_LOGIN_PROVIDER=dev
DEV_TEST_USERNAME=alice
DEV_TEST_PASSWORD=plaintext_password
```

```json
// backend/dev-users.json (local development - gitignored)
[
  {
    "username": "alice",
    "passwordHash": "--redacted--.",
    "name": "Alice Attorney",
    "roles": ["TrialAttorney", "PrivilegedIdentityUser"],
    "offices": ["USTP_CAMS_Region_2_Office_Manhattan"]
  }
]
```

**Note**: For cloud deployments, the `dev-users.json` content is stored in Azure Key Vault as the `DEV-USERS` secret and automatically deployed to the function app during the build process.

**Option 2: MongoDB Database (Deployed Environments)**
```bash
# Backend .env (MongoDB fallback enabled automatically)
CAMS_LOGIN_PROVIDER=dev
MONGO_CONNECTION_STRING=mongodb://your-connection-string

# No dev-users.json file needed - users loaded from MongoDB
```

The MongoDB `dev-users` database and `users` collection are provisioned automatically during database deployment via the GitHub Actions workflow (`.github/workflows/reusable-database-deploy.yml`). User documents in MongoDB follow the same schema as the JSON file.

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
1. **Azure-compatible**: Can be used in Azure-hosted development environments with credentials stored in Key Vault or MongoDB
1. **Dual-source support**: JSON file for local dev, MongoDB fallback for deployed environments provides flexibility
1. **No external dependencies**: Does not require Keycloak, additional Okta instances, or other third-party services
1. **Graceful degradation**: Automatic fallback from JSON to MongoDB to empty database ensures system continues to function
1. **Secure**: Passwords are hashed and salted, never stored in plain text
1. **E2E testable**: Full support for automated testing with configurable test credentials
1. **Production-like flows**: Tests actual authentication flow with username/password instead of mock selection
1. **Independent implementation**: Clean separation from mock mode allows both to coexist and be maintained separately
1. **Better DX**: JSON file configuration is more readable and maintainable than environment variable JSON strings
1. **Centralized credentials**: MongoDB option allows shared user database across multiple instances in deployed environments

### Negative
1. **Not for production**: Dev mode is explicitly for development and test environments only
1. **Manual hash generation**: Developers must use the utility script to generate password hashes (intentional security trade-off)
1. **File management**: Developers must ensure `dev-users.json` is properly configured and not committed to git (when using JSON option)
1. **Database management**: MongoDB option requires managing user documents in a separate database
1. **Fallback complexity**: Two configuration sources increase complexity of troubleshooting authentication issues
1. **Additional maintenance**: Three authentication modes (okta, mock, dev) require more maintenance than two

### Security Considerations
- **Never commit dev-users.json to git**: File is gitignored and should remain local or deployed from Key Vault
- **Use strong passwords**: Even for development environments, use passwords with sufficient entropy
- **Rotate credentials**: Development environment credentials should be rotated periodically (both JSON and MongoDB)
- **Limit access**: Restrict access to:
  - `dev-users.json` files and Azure Key Vault secrets containing user data
  - MongoDB `dev-users` database via connection string and network security rules
- **MongoDB security**: Ensure `dev-users` database has appropriate access controls and is not exposed publicly

### Migration Path
- Mock mode remains available for quick local testing
- Dev mode can be adopted incrementally by teams that need more realistic authentication
- Okta remains the only production authentication method
- Future: Mock mode may be deprecated if dev mode proves sufficient for all development use cases

### Usage Recommendation
- **Mock mode**: Quick local testing, no authentication needed
- **Dev mode with JSON file**: Local development with personalized user accounts
- **Dev mode with MongoDB**: Shared development environments, centralized user management, Azure deployments
- **Okta mode**: Production, staging, and environments requiring real DOJ user accounts

**Choosing Between JSON and MongoDB for Dev Mode**:
- Use **JSON file** when:
  - Working locally on your development machine
  - Need quick iteration on user configurations
  - Testing with personal/isolated user accounts
- Use **MongoDB** when:
  - Deploying to Azure development environments
  - Multiple developers need to share the same user database
  - Want centralized credential management
  - JSON file deployment is impractical or unavailable
