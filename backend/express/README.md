# Express Local Development Server

## Overview

This Express server provides an alternative to Azure Functions for local development. It was created
to work around Azure Functions local development issues while maintaining full compatibility with
the existing CAMS backend architecture.

**Status:** ✅ All functionality complete - 21 endpoints implemented (me, cases, assignments,
docket, history, notes, summary, associated, orders, orders-suggestions, consolidations, trustees,
trustee-assignments, trustee-history, offices, courts, staff, lists, privileged-identity-admin,
oauth2, healthcheck)

## What's Been Completed

### 1. Core Infrastructure

- **Express server** (`server.ts`) - Main application setup with CORS and middleware
- **ApplicationContext creator** (`application-context-creator.ts`) - Converts Express requests to
  CAMS ApplicationContext
- **Response/Error adapters** (`adapters.ts`) - Converts CAMS responses to Express responses
- **Graceful shutdown** - Handles SIGINT/SIGTERM for proper server termination

### 2. Features Implemented

- ✅ CORS support (handles preflight OPTIONS requests)
- ✅ Bearer token authentication
- ✅ Session lookup via getUserSessionUseCase
- ✅ ApplicationContext pattern (matches Azure Functions)
- ✅ Error handling middleware
- ✅ Request sanitization
- ✅ Deferrable resource cleanup

### 3. Routes Implemented

- ✅ `GET /api/me` - Returns current user session (MeController)
- ✅ `GET, POST /api/cases/{caseId?}` - Case search and details (CasesController)
- ✅ `GET, POST, PUT, DELETE /api/case-assignments/{id?}` - Attorney assignments
  (CaseAssignmentController)
- ✅ `GET /api/cases/{caseId}/docket` - Case docket entries (CaseDocketController)
- ✅ `GET /api/cases/{id}/history` - Case history (CaseHistoryController)
- ✅ `GET, POST, PUT, DELETE /api/cases/{caseId}/notes/{noteId?}/{userId?}` - Case notes
  (CaseNotesController)
- ✅ `GET /api/cases/{caseId?}/summary` - Case summary (CaseSummaryController)
- ✅ `GET /api/cases/{caseId?}/associated` - Associated cases (CaseAssociatedController)
- ✅ `GET, PATCH /api/orders/{id?}` - Orders management (OrdersController)
- ✅ `GET /api/orders-suggestions/{caseId?}` - Order suggestions (OrdersController)
- ✅ `PUT /api/consolidations/{procedure}` - Consolidation procedures (OrdersController)
- ✅ `GET, POST, PATCH /api/trustees/{id?}` - Trustee management (TrusteesController)
- ✅ `GET, POST /api/trustees/{trusteeId}/oversight-assignments` - Trustee assignments
  (TrusteeAssignmentsController)
- ✅ `GET /api/trustees/{trusteeId?}/history` - Trustee history (TrusteeHistoryController)
- ✅ `GET /api/offices/{officeCode?}/{subResource?}` - Office information (OfficesController)
- ✅ `GET /api/courts` - Court information (CourtsController)
- ✅ `GET /api/staff` - Staff information (StaffController)
- ✅ `GET, POST, DELETE /api/lists/{listName}/{id?}` - Lists management (ListsController)
- ✅ `GET, PUT, DELETE /api/dev-tools/privileged-identity/{resourceId?}` - Admin identity
  (PrivilegedIdentityAdminController)
- ✅ `POST /api/oauth2/default` - Mock OAuth2 endpoint (custom implementation)
- ✅ `GET /api/healthcheck` - Health check endpoint (custom implementation)

### 4. Build & Run

- ✅ TypeScript compilation to `dist/backend/express/`
- ✅ npm script: `npm run start:express`
- ✅ Runs on port 7071 (same as Azure Functions)

## Recent Additions

### Orders & Consolidations Support (Latest Implementation)

Three additional endpoints have been implemented to support orders and consolidations functionality:

1. **Orders Management** - `GET, PATCH /api/orders/{id?}`
   - Handles order retrieval and updates
   - Uses OrdersController for all business logic
   - Supports both listing orders and individual order operations

2. **Orders Suggestions** - `GET /api/orders-suggestions/{caseId?}`
   - Provides suggested cases for order transfers
   - Case-based routing with optional caseId parameter
   - Uses OrdersController for suggestion logic

3. **Consolidations** - `PUT /api/consolidations/{procedure}`
   - Handles consolidation procedure operations
   - Procedure-based routing (e.g., "approve", "reject")
   - Uses OrdersController for consolidation management

All three endpoints follow the standard Express pattern:

- ApplicationContext creation with authentication
- Controller instantiation with context
- Response conversion and cleanup
- Consistent error handling

## Architecture Pattern

The Express implementation follows this pattern for each endpoint:

```typescript
app.METHOD('/api/ROUTE', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Create ApplicationContext (includes authentication)
    const context = await applicationContextCreator(req);

    // 2. Instantiate the appropriate controller
    const controller = new SomeController(context);

    // 3. Call handleRequest (controller handles routing logic)
    const camsResponse = await controller.handleRequest(context);

    // 4. Convert and send response
    sendCamsResponse(res, camsResponse);

    // 5. Clean up resources
    await finalizeDeferrable(context);
  } catch (error) {
    next(error); // Error middleware handles this
  }
});
```

## Implementation Complete ✅

All Azure Function endpoints have been successfully implemented in the Express server! The server
now provides complete compatibility with the existing CAMS backend architecture for local
development.

### Implemented Endpoints Summary

All **21 endpoints** from the Azure Functions have been implemented:

#### Core CAMS Endpoints

1. **me** - User session information
2. **cases** - Case search and details
3. **case-assignments** - Attorney assignments
4. **case-docket** - Case docket entries
5. **case-history** - Case history
6. **case-notes** - Case notes management
7. **case-summary** - Case summaries
8. **case-associated** - Associated cases

#### Orders & Consolidations

9. **orders** - Orders management
10. **orders-suggestions** - Order suggestions
11. **consolidations** - Consolidation procedures

#### Trustees & Administration

12. **trustees** - Trustee management
13. **trustee-assignments** - Trustee oversight assignments
14. **trustee-history** - Trustee history

#### System Information

15. **offices** - Office information
16. **courts** - Court information
17. **staff** - Staff management
18. **lists** - Various lists management

#### Development & Administration

19. **privileged-identity-admin** - Privileged identity management
20. **oauth2** - Mock OAuth2 authentication
21. **healthcheck** - System health monitoring

### Implementation Notes

#### Special Endpoint Implementations

**OAuth2 Mock Endpoint** (`POST /api/oauth2/default`)

- Custom implementation using `mockAuthentication()` function
- Returns mock JWT tokens for local development
- No controller required - direct function call

**Healthcheck Endpoint** (`GET /api/healthcheck`)

- Custom implementation with database connectivity checks
- Tests both Cosmos DB and SQL DB connections
- Returns comprehensive system status
- Uses `HealthcheckCosmosDb`, `HealthcheckSqlDb`, and `HealthcheckInfo` classes

#### Route Patterns Implemented

The following route patterns were faithfully reproduced from Azure Functions:

- `/api/trustees/{id?}` - Optional ID parameter
- `/api/trustees/{trusteeId}/oversight-assignments` - Nested resource
- `/api/trustees/{trusteeId?}/history` - Optional trustee ID
- `/api/offices/{officeCode?}/{subResource?}` - Multiple optional parameters
- `/api/lists/{listName}/{id?}` - Required listName, optional ID
- `/api/dev-tools/privileged-identity/{resourceId?}` - Admin path with optional resource

### Refactoring Opportunities

Now that all endpoints are implemented, consider these improvements:

1. **Extract route registration** into separate files (e.g., `routes/trustees.routes.ts`)
2. **Create route factory** to reduce boilerplate code
3. **Add route-level middleware** for specific endpoints (e.g., admin-only routes)
4. **Add request validation** using existing CAMS validators
5. **Add integration tests** for Express routes
6. **Add OpenAPI/Swagger documentation** for the Express API

## File Structure

```
backend/express/
├── server.ts                        # Main Express app and route registration
├── application-context-creator.ts   # Express → ApplicationContext converter
├── adapters.ts                      # Response/Error converters
└── README.md                        # This file
```

## Testing

### Manual Testing

```bash
# Start server
npm run start:express

# Test endpoint
curl -i http://localhost:7071/api/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Stopping the Server

Press **Ctrl+C** to trigger graceful shutdown. The server will:

1. Log "Received SIGINT, shutting down gracefully..."
2. Close existing connections
3. Log "Server closed" and exit

## Dependencies

- **express@4.21.2** - Web framework
- **@types/express@4.17.23** - TypeScript types

All other dependencies are shared with the existing backend (`/backend/lib`).

## Important Notes

- **This code is for local development only** - Azure Functions remain unchanged for production
- **Port 7071** must be free (same port Azure Functions uses)
- **All controllers are reused** from `/backend/lib/controllers` without modification
- **ApplicationContext pattern** is maintained exactly as Azure Functions implementation
- **CORS is enabled** for all origins (local development only)

## Troubleshooting

### Server won't start - Port in use

```bash
# Kill process on port 7071
lsof -ti:7071 | xargs kill -9
```

### TypeScript compilation errors

```bash
# Rebuild from scratch
npm run build
```

### Authentication issues

Ensure your JWT token is valid and the `CAMS_LOGIN_PROVIDER` environment variable is set correctly
in `.env`.

## Workflow ID

This work was completed using workflow ID: **3e855bcf**

For questions or issues, see the main CAMS documentation in `/docs`.
