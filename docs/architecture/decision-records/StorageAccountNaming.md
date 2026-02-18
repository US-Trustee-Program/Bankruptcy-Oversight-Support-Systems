# Storage Account Naming Convention

## Context

Azure Functions requires `AzureWebJobsStorage` for runtime operations (timer coordination, host management, key storage). This is a requirement of the Azure Functions platform itself.

CAMS architecture also requires both function apps to access the dataflows storage account:
- API writes event messages to dataflows queues
- Dataflows reads messages from those queues

Initially, CAMS tried to use `AzureWebJobsApiStorage` and `AzureWebJobsDataflowsStorage` to handle both runtime and application storage. However, this conflated two separate concerns and created confusion about which connection served which purpose.

## Decision

CAMS separates runtime storage from application storage using two different configuration mechanisms:

**Runtime Storage (Azure Functions requirement)**
- `AzureWebJobsStorage` - Required by Azure Functions runtime for each function app
- Configured in `local.settings.json` for local development
- Set by Bicep deployment for cloud environments
- Each function app has its own runtime storage account

**Application Storage (CAMS application logic)**
- `CAMS_DATAFLOWS_STORAGE_CONNECTION` - Connection to the dataflows storage account for application queues
- Configured in `backend/.env` for local development
- Set by Bicep deployment for cloud environments
- Shared by both API (writes) and dataflows (reads)

## Status

Accepted

## Consequences

### Benefits
- **Separation of concerns**: Runtime requirements separate from application logic
- **CAMS naming convention**: Application variables use `CAMS_` prefix consistently
- **Clarity**: Clear distinction between Azure Functions infrastructure and CAMS business logic
- **Simpler configuration**: Runtime storage uses standard Azure Functions variables; application storage uses CAMS conventions

### Trade-offs
- **Two configuration locations**: Runtime storage in `local.settings.json`, application storage in `.env`
- **Migration required**: Existing deployments using `AzureWebJobsApiStorage`/`AzureWebJobsDataflowsStorage` must be updated

### Configuration Impact
- `local.settings.json` only contains `AzureWebJobsStorage` and Azure Functions-specific settings
- `backend/.env` contains all CAMS application settings including `CAMS_DATAFLOWS_STORAGE_CONNECTION`
- Deployment slot configurations must include both runtime and application storage settings
- Infrastructure templates (Bicep) must set both `AzureWebJobsStorage` and `CAMS_DATAFLOWS_STORAGE_CONNECTION`
