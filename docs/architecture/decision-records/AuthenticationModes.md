# Authentication Modes

## Context

CAMS requires authentication for both production use and local development. The application evolved from exploring ADFS (Active Directory Federation Services) to adopting Okta as the primary identity provider, aligning with USTP's organization-wide authentication strategy.

During development, we need the ability to:

1. Test the application locally without requiring external authentication services
1. Run automated end-to-end tests without complex authentication setup
1. Use production-grade authentication in deployed environments

Early in the project, we experimented with multiple authentication modes (mock, dev, okta), but this created unnecessary complexity. We needed a simpler approach that balanced local development convenience with production authentication requirements.

## Decision

CAMS uses two authentication modes, selected via the `CAMS_LOGIN_PROVIDER` environment variable:

1. **mock**: Simplified authentication for local development and testing
    - Presents a UI for selecting pre-configured user roles
    - No external authentication service required
    - No credentials needed
    - Suitable for local development and automated testing

1. **okta**: Production authentication using Okta
    - Full OAuth 2.0 / OpenID Connect flow
    - Integrates with USTP's Okta organization
    - Multifactor authentication support
    - Required for all deployed environments (staging, production)

1. **none**: No authentication
    - Used for a11y testing
    - Could be used for some local development scenarios

## Status

Accepted

This ADR supersedes the original [Authentication ADR](Authentication.md), which documented the decision to use Okta over ADFS. This ADR focuses on the authentication modes themselves rather than the provider selection.

## Consequences

Flexion's deployed environments use services from Okta that match closely how USTP's services function. For rapid development and testing, the mock authentication mode enables developers to work without external authentication services.
