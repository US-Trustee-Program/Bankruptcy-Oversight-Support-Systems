# Express Migration

This directory contains the Express.js implementation that replaces the Azure Functions HTTP
triggers with standard Express routing.

## Files

- **`application-context-creator.ts`** - Express version of the application context creator, removes
  Azure Functions dependencies
- **`functions.ts`** - Express utilities for converting Express request/response to CAMS format
- **`routes.ts`** - Express router that maps all existing Azure Function endpoints to Express routes
- **`app.ts`** - Basic Express application setup
- **`*.test.ts`** - Unit tests for the Express integration

## Key Changes from Azure Functions

1. **No InvocationContext**: Removed dependency on Azure Functions `InvocationContext`
2. **Express Request/Response**: Converted Azure Functions HTTP triggers to Express middleware
3. **Route Mapping**: All existing Azure Function routes (`attorneys/{id}`, `cases/{caseId}`, etc.)
   are preserved with identical paths
4. **Controller Integration**: Controllers remain unchanged - the Express layer provides the same
   interface

## Usage

The Express version maintains the same API contract as the Azure Functions implementation:

- Same HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Same route patterns (with Express parameter syntax `:id` instead of `{id}`)
- Same request/response body structures
- Same authentication and authorization flows
- Same error handling patterns

## Testing

Run the Express-specific tests:

```bash
npm test -- --testPathPattern=express
```

## Next Steps

1. **Containerization**: Package the Express app in a Docker container
2. **Deployment**: Deploy to Azure Container Apps
3. **CI/CD**: Update build pipelines to create container images instead of function app packages
4. **Monitoring**: Ensure Application Insights integration works correctly
5. **Performance Testing**: Validate that Express performance meets requirements
