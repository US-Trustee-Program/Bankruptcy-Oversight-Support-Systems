# Storage Account Naming Convention

## Context

Azure Functions requires `AzureWebJobsStorage` for runtime operations (timer coordination, host management, key storage). This is a requirement of the Azure Functions platform itself.

CAMS architecture requires both function apps to access the dataflows storage account:
- API writes event messages to dataflows queues via Azure Functions output bindings
- Dataflows reads messages from those queues via Azure Functions queue triggers

Azure Functions bindings use the `AzureWebJobs` prefix for connection string environment variables. When you specify `connection: 'DataflowsStorage'` in a binding, the runtime automatically looks for `AzureWebJobsDataflowsStorage` in the environment.

## Decision

CAMS uses Azure Functions v4 naming convention with descriptive suffixes:

**API Function App**
- `AzureWebJobsStorage` - API's own runtime storage account
- `AzureWebJobsDataflowsStorage` - Dataflows storage account for writing queue messages

**Dataflows Function App**
- `AzureWebJobsStorage` - Dataflows storage account for runtime operations
- `AzureWebJobsDataflowsStorage` - Dataflows storage account for queue triggers (same value as `AzureWebJobsStorage`)

Both storage connections must be set because the shared `lib/storage-queues.ts` module defines bindings with `connection: 'DataflowsStorage'`, which causes Azure Functions runtime to look for `AzureWebJobsDataflowsStorage` in both function apps.

The `AzureWebJobs` prefix follows Azure Functions v4 conventions, while the suffix (`DataflowsStorage`) provides clarity about which storage account is referenced.

## Status

Accepted

## Consequences

### Benefits
- **Azure Functions compatibility**: Uses the naming convention expected by Azure Functions bindings
- **Separation of concerns**: Runtime storage separate from application storage
- **Consistency**: Same naming used in local development, cloud deployment, and Portal
- **Clarity**: Descriptive suffixes make it obvious which storage account is referenced
- **No prefix duplication**: Azure Functions runtime prepends `AzureWebJobs` to connection names in bindings; by including it in the variable name, we avoid the runtime creating names like `AzureWebJobsAzureWebJobsDataflowsStorage`

### Trade-offs
- **Azure naming convention**: Uses Azure's `AzureWebJobs` prefix rather than CAMS-specific prefix, prioritizing Azure Functions compatibility
- **Duplicate configuration**: Dataflows needs both `AzureWebJobsStorage` and `AzureWebJobsDataflowsStorage` set to the same value
- **Multiple storage accounts**: Two total storage accounts needed (API runtime, dataflows runtime/application)

### Configuration Impact
- All storage connections configured in `local.settings.json` for local development
- Infrastructure templates (Bicep) set both `AzureWebJobsStorage` and `AzureWebJobsDataflowsStorage` for each function app
- Deployment slot configurations must maintain consistent naming across environments
