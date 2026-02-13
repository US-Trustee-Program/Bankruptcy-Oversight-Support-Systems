# CAMS Backend

## Environment Variables

### Storage Connections

CAMS uses explicit, CAMS-prefixed environment variables for storage account connections:

#### API Function App
- `CAMS_API_STORAGE_CONNECTION`: API's own storage account for runtime operations
- `CAMS_DATAFLOWS_STORAGE_CONNECTION`: Dataflows storage account for queue writes

#### Dataflows Function App
- `CAMS_DATAFLOWS_STORAGE_CONNECTION`: Dataflows storage account

### Local Development Setup

Configure local.settings.json for each function app:

**backend/function-apps/api/local.settings.json:**
```json
{
  "Values": {
    "CAMS_API_STORAGE_CONNECTION": "UseDevelopmentStorage=true",
    "CAMS_DATAFLOWS_STORAGE_CONNECTION": "UseDevelopmentStorage=true"
  }
}
```

**backend/function-apps/dataflows/local.settings.json:**
```json
{
  "Values": {
    "CAMS_DATAFLOWS_STORAGE_CONNECTION": "UseDevelopmentStorage=true"
  }
}
```

For local development, both can point to the same Azurite instance since queues are namespaced by name.

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
