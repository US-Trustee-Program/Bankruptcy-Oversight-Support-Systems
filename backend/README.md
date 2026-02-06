# CAMS Backend

## Environment Variables

### Storage Connections

CAMS uses two types of storage connections:

#### Runtime Storage (`AzureWebJobsStorage`)
Each function app requires its own storage account for Azure Functions runtime operations (timer coordination, host management, key storage):

- API function app: Uses its own runtime storage
- Dataflows function app: Uses its own runtime storage
- Set in `local.settings.json` for local development
- Set by Bicep deployment for cloud environments

#### Application Queue Storage (`AzureWebJobsDataflowsStorage`)
The dataflows storage account is used for application-level queues (Azure Functions bindings):

- Used by both API (writes queue messages) and dataflows (reads queue messages)
- Must be set in `local.settings.json` for both function apps (same value for both)
- Set by Bicep deployment for cloud environments

### Local Development Setup

**backend/function-apps/api/local.settings.json:**
```json
{
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "<your-api-storage-connection-string>",
    "AzureWebJobsDataflowsStorage": "<dataflows-storage-connection-string>"
  }
}
```

**backend/function-apps/dataflows/local.settings.json:**
```json
{
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "<your-dataflows-storage-connection-string>",
    "AzureWebJobsDataflowsStorage": "<dataflows-storage-connection-string>",
    "MyTaskHub": "<unique-name>"
  }
}
```

Note: For dataflows, both `AzureWebJobsStorage` and `AzureWebJobsDataflowsStorage` point to the **same** dataflows storage account.

### Unit Tests

Unit tests use dummy storage connection strings and **do not** require actual storage accounts. ApplicationConfiguration automatically provides non-functional default connection strings when environment variables are not set, satisfying configuration validation without attempting actual connections.

## API to Dataflows Communication

### ApiToDataflowsGateway

API use cases communicate with dataflows through `ApiToDataflowsGateway`. This is the ONLY gateway for triggering dataflows events.

**Usage:**
```typescript
import factory from '../../factory';

class MyUseCase {
  private apiToDataflowsGateway: ApiToDataflowsGateway;

  constructor(context: ApplicationContext) {
    this.apiToDataflowsGateway = factory.getApiToDataflowsGateway(context);
  }

  async myMethod() {
    // Queue a case assignment event
    await this.apiToDataflowsGateway.queueCaseAssignmentEvent(assignment);

    // Queue a case reload
    await this.apiToDataflowsGateway.queueCaseReload(caseId);
  }
}
```

**Adding New Dataflows Events:**

When API needs to trigger a new dataflows event:

1. Add event type to `common/src/cams/dataflow-events.ts`
2. Add method to `ApiToDataflowsGateway` interface in `backend/lib/use-cases/gateways.types.ts`
3. Implement method in `ApiToDataflowsGatewayImpl` in `backend/lib/adapters/gateways/api-to-dataflows/api-to-dataflows.gateway.ts`
4. Create queue trigger in dataflows

**Important:** Never use storage queue infrastructure directly from use cases. Always use `ApiToDataflowsGateway`.
