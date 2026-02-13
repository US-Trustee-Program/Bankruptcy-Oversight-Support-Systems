# Storage Account Naming Convention

## Context

Azure Functions uses `AzureWebJobsStorage` as the default environment variable for storage account connection strings. This works well when a function app only needs one storage account.

CAMS architecture requires API to access multiple storage accounts:
- Its own storage account for runtime operations (host state, durable functions, etc.)
- Dataflows storage account for writing queue messages

Using the single `AzureWebJobsStorage` variable name doesn't support this multi-storage-account pattern.

## Decision

CAMS uses explicit, CAMS-prefixed environment variable names for all storage connections:

- `CAMS_API_STORAGE_CONNECTION` - API's own storage account
- `CAMS_DATAFLOWS_STORAGE_CONNECTION` - Dataflows storage account

All Azure Function Apps in CAMS (API, Dataflows) use this naming convention instead of `AzureWebJobsStorage`.

## Status

Accepted

## Consequences

### Benefits
- **Clarity**: Explicit naming makes it obvious which storage account is referenced
- **Multi-storage support**: Pattern extends naturally to additional storage accounts if needed
- **Consistency**: CAMS naming convention (`CAMS_*`) applied uniformly across infrastructure

### Trade-offs
- **Azure Functions Runtime**: Requires verification that runtime works without `AzureWebJobsStorage`
  - If runtime requires it, can create alias pointing to same value as `CAMS_API_STORAGE_CONNECTION`
- **Documentation**: Deviates from Azure Functions defaults, requires clear documentation

### Configuration Impact
- Function apps requiring multiple storage accounts must configure all necessary connection variables
- Infrastructure templates, local development settings, and secure storage must all use the CAMS-prefixed names
- Deployment slot configurations must maintain consistent naming across environments
