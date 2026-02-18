# CAMS Backend

## Environment Variables

### Storage Connections

CAMS storage configuration follows these conventions:

#### Azure Functions Runtime Storage
Both function apps require `AzureWebJobsStorage` for Azure Functions runtime operations (timer coordination, host management, key storage):

- Set in `local.settings.json` for local development
- Set by Bicep deployment for cloud environments

#### Application Queue Storage
The dataflows storage account connection is used for application-level queues. Configure this in the backend `.env` file:

```
CAMS_DATAFLOWS_STORAGE_CONNECTION=<connection-string>
```

This environment variable is read by `ApplicationConfiguration` and used by both API (to write events) and dataflows (to read events).

### Local Development Setup

**backend/function-apps/api/local.settings.json:**
```json
{
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "<your-api-storage-connection-string>"
  }
}
```

**backend/function-apps/dataflows/local.settings.json:**
```json
{
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "<your-dataflows-storage-connection-string>",
    "MyTaskHub": "<unique-name>"
  }
}
```

**backend/.env:**
```
CAMS_DATAFLOWS_STORAGE_CONNECTION=<dataflows-storage-connection-string>
```

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
