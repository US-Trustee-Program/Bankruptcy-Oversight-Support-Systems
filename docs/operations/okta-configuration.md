# Okta Configuration

This document describes Okta configuration for the CAMS application. For local development setup, see [Running - Backend Prerequisites](../running.md#backend-prerequisites).

## Overview

CAMS uses Okta for authentication and authorization in deployed environments. The application integrates with an Okta organization that manages user identities, groups, and access policies.

## Okta Organization Structure

The CAMS application connects to an Okta organization that:

- Manages user accounts and authentication
- Provides OAuth 2.0 / OpenID Connect flows
- Manages user groups for role-based access control
- Supports multi-factor authentication (MFA)

## Multi-Factor Authentication (MFA)

### TOTP Authenticator Setup

Okta supports time-based one-time password (TOTP) authentication using standard authenticator apps.

#### Supported Authenticator Apps

- Okta Verify

#### Setting Up 1Password as Authenticator

1. During Okta MFA setup, select the "Google Authenticator" option
1. Okta will display a QR code
1. In 1Password:
    1. Edit your Okta login item
    1. Add a "One-Time Password" field
    1. Scan the QR code or manually enter the secret key
    1. Save the item
1. 1Password will generate 6-digit codes that refresh every 30 seconds
1. Enter the code in Okta to complete setup

**Benefits of 1Password:**

- Autofill both password and TOTP code
- Cross-platform synchronization
- Backup in Key Vault
- Team sharing capabilities

## Okta Applications

CAMS uses two Okta applications:

1. CAMS
   1. Single Page App (SPA) application type
   1. Provides End-user authentication flow
1. CAMS Group Sync \[Dev]
   1. Service application type
   1. Provides the CAMS API access to users and groups
   1. CAMS uses **API Key Authentication** to connect to the Okta API.

### Required Configuration

Two environment variables configure the Okta SDK:

1. `CAMS_USER_GROUP_GATEWAY_CONFIG`: Pipe-delimited configuration string
    - Format: `url={oktaApiUrl}`
    - Example: `url=https://your-org.okta.com`

1. `OKTA_API_KEY`: API token for authentication
    - Obtained from Okta Admin Console
    - Stored in Azure Key Vault for deployed environments
    - Must have appropriate permissions for user/group operations

### Required Permissions

The Okta API token must have permissions to:

- Read user information
- Read group memberships

## References

- [Okta Developer Documentation](https://developer.okta.com/)
- [RFC 6238 - TOTP Specification](https://tools.ietf.org/html/rfc6238)
- [CAMS Running Guide](../running.md)
- [Authentication Modes ADR](../architecture/decision-records/AuthenticationModes.md)
