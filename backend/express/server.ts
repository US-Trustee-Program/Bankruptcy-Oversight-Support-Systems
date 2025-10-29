import * as dotenv from 'dotenv';
import * as express from 'express';
import { Application, Request, Response, NextFunction } from 'express';
import { applicationContextCreator } from './application-context-creator';
import { sendCamsResponse, errorHandler } from './adapters';
import { ApplicationContext } from '../lib/adapters/types/basic';
import { MeController } from '../lib/controllers/me/me.controller';
import { CasesController } from '../lib/controllers/cases/cases.controller';
import { CaseAssignmentController } from '../lib/controllers/case-assignment/case.assignment.controller';
import { CaseDocketController } from '../lib/controllers/case-docket/case-docket.controller';
import { CaseHistoryController } from '../lib/controllers/case-history/case-history.controller';
import { CaseNotesController } from '../lib/controllers/case-notes/case.notes.controller';
import { CaseNoteInput } from '../../common/src/cams/cases';
import { CaseSummaryController } from '../lib/controllers/case-summary/case-summary.controller';
import { CaseAssociatedController } from '../lib/controllers/case-associated/case-associated.controller';
import { OrdersController } from '../lib/controllers/orders/orders.controller';
import { TrusteesController } from '../lib/controllers/trustees/trustees.controller';
import { TrusteeAssignmentsController } from '../lib/controllers/trustee-assignments/trustee-assignments.controller';
import { TrusteeHistoryController } from '../lib/controllers/trustee-history/trustee-history.controller';
import { OfficesController } from '../lib/controllers/offices/offices.controller';
import { CourtsController } from '../lib/controllers/courts/courts.controller';
import { StaffController } from '../lib/controllers/staff/staff.controller';
import { ListsController } from '../lib/controllers/lists/lists.controller';
import { PrivilegedIdentityAdminController } from '../lib/controllers/admin/privileged-identity-admin.controller';
import { finalizeDeferrable } from '../lib/deferrable/finalize-deferrable';
import { mockAuthentication } from '../lib/testing/mock-gateways/mock-oauth2-gateway';
import { httpSuccess } from '../lib/adapters/utils/http-response';
import HttpStatusCodes from '../../common/src/api/http-status-codes';
import HealthcheckCosmosDb from '../function-apps/api/healthcheck/healthcheck.db.cosmos';
import HealthcheckSqlDb from '../function-apps/api/healthcheck/healthcheck.db.sql';
import HealthcheckInfo from '../function-apps/api/healthcheck/healthcheck.info';
import { closeDeferred } from '../lib/deferrable/defer-close';

dotenv.config();

const PORT = process.env.PORT || 7071;

// Helper function for healthcheck
export function checkResults(...results: boolean[]) {
  for (const i in results) {
    if (!results[i]) {
      return false;
    }
  }
  return true;
}

export function createApp(): Application {
  const app = express();

  // CORS middleware
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    next();
  });

  // Parse JSON bodies
  app.use(express.json());

  // Register routes
  app.get('/api/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);
      const controller = new MeController();
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  });

  // Cases endpoint - handles both GET and POST with optional caseId
  const handleCases = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);
      const controller = new CasesController(context);
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/cases', handleCases);
  app.get('/api/cases/:caseId', handleCases);
  app.post('/api/cases', handleCases);
  app.post('/api/cases/:caseId', handleCases);

  // Case assignments endpoint - handles GET, POST, PUT, DELETE with optional id
  const handleCaseAssignments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);
      const controller = new CaseAssignmentController(context);
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/case-assignments', handleCaseAssignments);
  app.get('/api/case-assignments/:id', handleCaseAssignments);
  app.post('/api/case-assignments', handleCaseAssignments);
  app.post('/api/case-assignments/:id', handleCaseAssignments);
  app.put('/api/case-assignments', handleCaseAssignments);
  app.put('/api/case-assignments/:id', handleCaseAssignments);
  app.delete('/api/case-assignments', handleCaseAssignments);
  app.delete('/api/case-assignments/:id', handleCaseAssignments);

  // Case docket endpoint - GET only with caseId required
  const handleCaseDocket = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);
      const controller = new CaseDocketController(context);
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/cases/:caseId/docket', handleCaseDocket);

  // Case history endpoint - GET only with id (caseId)
  const handleCaseHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);
      const controller = new CaseHistoryController();
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/cases/:id/history', handleCaseHistory);

  // Case notes endpoint - GET, POST, PUT, DELETE with caseId required and optional noteId/userId
  const handleCaseNotes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);
      const controller = new CaseNotesController(context);
      const camsResponse = await controller.handleRequest(
        context as ApplicationContext<CaseNoteInput>,
      );
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/cases/:caseId/notes', handleCaseNotes);
  app.get('/api/cases/:caseId/notes/:noteId', handleCaseNotes);
  app.get('/api/cases/:caseId/notes/:noteId/:userId', handleCaseNotes);
  app.post('/api/cases/:caseId/notes', handleCaseNotes);
  app.post('/api/cases/:caseId/notes/:noteId', handleCaseNotes);
  app.post('/api/cases/:caseId/notes/:noteId/:userId', handleCaseNotes);
  app.put('/api/cases/:caseId/notes', handleCaseNotes);
  app.put('/api/cases/:caseId/notes/:noteId', handleCaseNotes);
  app.put('/api/cases/:caseId/notes/:noteId/:userId', handleCaseNotes);
  app.delete('/api/cases/:caseId/notes', handleCaseNotes);
  app.delete('/api/cases/:caseId/notes/:noteId', handleCaseNotes);
  app.delete('/api/cases/:caseId/notes/:noteId/:userId', handleCaseNotes);

  // Case summary endpoint - GET only with optional caseId
  const handleCaseSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);
      const controller = new CaseSummaryController(context);
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/cases/summary', handleCaseSummary);
  app.get('/api/cases/:caseId/summary', handleCaseSummary);

  // Case associated endpoint - GET only with optional caseId
  const handleCaseAssociated = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);
      const controller = new CaseAssociatedController();
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/cases/associated', handleCaseAssociated);
  app.get('/api/cases/:caseId/associated', handleCaseAssociated);

  // Orders endpoint - GET and PATCH with optional id
  const handleOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);
      const controller = new OrdersController(context);
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/orders', handleOrders);
  app.get('/api/orders/:id', handleOrders);
  app.patch('/api/orders', handleOrders);
  app.patch('/api/orders/:id', handleOrders);

  // Orders suggestions endpoint - GET only with optional caseId
  const handleOrdersSuggestions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);
      const controller = new OrdersController(context);
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/orders-suggestions', handleOrdersSuggestions);
  app.get('/api/orders-suggestions/:caseId', handleOrdersSuggestions);

  // Consolidations endpoint - PUT only with procedure parameter
  const handleConsolidations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);
      const controller = new OrdersController(context);
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.put('/api/consolidations/:procedure', handleConsolidations);

  // Trustees endpoint - GET, POST, PATCH with optional id
  const handleTrustees = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);
      const controller = new TrusteesController(context);
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/trustees', handleTrustees);
  app.get('/api/trustees/:id', handleTrustees);
  app.post('/api/trustees', handleTrustees);
  app.post('/api/trustees/:id', handleTrustees);
  app.patch('/api/trustees', handleTrustees);
  app.patch('/api/trustees/:id', handleTrustees);

  // Trustee assignments endpoint - GET, POST with trusteeId required
  const handleTrusteeAssignments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);
      const controller = new TrusteeAssignmentsController(context);
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/trustees/:trusteeId/oversight-assignments', handleTrusteeAssignments);
  app.post('/api/trustees/:trusteeId/oversight-assignments', handleTrusteeAssignments);

  // Trustee history endpoint - GET only with optional trusteeId
  const handleTrusteeHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);
      const controller = new TrusteeHistoryController(context);
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/trustees/history', handleTrusteeHistory);
  app.get('/api/trustees/:trusteeId/history', handleTrusteeHistory);

  // Offices endpoint - GET only with optional officeCode and subResource
  const handleOffices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);
      const controller = new OfficesController();
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/offices', handleOffices);
  app.get('/api/offices/:officeCode', handleOffices);
  app.get('/api/offices/:officeCode/:subResource', handleOffices);

  // Courts endpoint - GET only
  const handleCourts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);
      const controller = new CourtsController();
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/courts', handleCourts);

  // Staff endpoint - GET only
  const handleStaff = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);
      const controller = new StaffController(context);
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/staff', handleStaff);

  // Lists endpoint - GET, POST, DELETE with listName required and optional id
  const handleLists = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);
      const controller = new ListsController();
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/lists/:listName', handleLists);
  app.get('/api/lists/:listName/:id', handleLists);
  app.post('/api/lists/:listName', handleLists);
  app.post('/api/lists/:listName/:id', handleLists);
  app.delete('/api/lists/:listName', handleLists);
  app.delete('/api/lists/:listName/:id', handleLists);

  // Privileged identity admin endpoint - GET, PUT, DELETE with optional resourceId
  const handlePrivilegedIdentityAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);
      const controller = new PrivilegedIdentityAdminController();
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/dev-tools/privileged-identity', handlePrivilegedIdentityAdmin);
  app.get('/api/dev-tools/privileged-identity/:resourceId', handlePrivilegedIdentityAdmin);
  app.put('/api/dev-tools/privileged-identity', handlePrivilegedIdentityAdmin);
  app.put('/api/dev-tools/privileged-identity/:resourceId', handlePrivilegedIdentityAdmin);
  app.delete('/api/dev-tools/privileged-identity', handlePrivilegedIdentityAdmin);
  app.delete('/api/dev-tools/privileged-identity/:resourceId', handlePrivilegedIdentityAdmin);

  // OAuth2 mock endpoint - POST only
  app.post('/api/oauth2/default', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);
      const token = await mockAuthentication(context);
      const camsResponse = httpSuccess({
        body: { data: { value: token } },
      });
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  });

  // Healthcheck endpoint - GET only
  app.get('/api/healthcheck', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await applicationContextCreator(req);

      const healthcheckCosmosDbClient = new HealthcheckCosmosDb(context);
      const healthCheckSqlDbClient = new HealthcheckSqlDb(context);

      context.logger.debug('HEALTHCHECK', 'Health check endpoint invoked');

      const cosmosStatus = await healthcheckCosmosDbClient.checkDocumentDb();

      Object.keys(cosmosStatus).forEach((key) => {
        context.logger.debug('HEALTHCHECK', key + ': ' + cosmosStatus[key]);
      });

      const checkSqlDbReadAccess = await healthCheckSqlDbClient.checkDxtrDbRead();
      context.logger.debug('HEALTHCHECK', 'SQL Dxtr Db Read Check return ' + checkSqlDbReadAccess);

      const healthcheckInfo = new HealthcheckInfo(context);
      const info = healthcheckInfo.getServiceInfo();

      const respBody = {
        database: {
          metadata: healthcheckCosmosDbClient.dbConfig(),
          cosmosDbWriteStatus: cosmosStatus.cosmosDbWriteStatus,
          cosmosDbReadStatus: cosmosStatus.cosmosDbReadStatus,
          cosmosDbDeleteStatus: cosmosStatus.cosmosDbDeleteStatus,
          sqlDbReadStatus: checkSqlDbReadAccess,
        },
        info,
      };

      await closeDeferred(context);

      const success = checkResults(
        cosmosStatus.cosmosDbDeleteStatus,
        cosmosStatus.cosmosDbReadStatus,
        cosmosStatus.cosmosDbWriteStatus,
        checkSqlDbReadAccess,
      );

      const camsResponse = httpSuccess({
        body: {
          data: { status: success ? 'OK' : 'ERROR', ...respBody },
        },
        statusCode: success ? HttpStatusCodes.OK : HttpStatusCodes.INTERNAL_SERVER_ERROR,
      });

      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  });

  // Error handler must be registered last
  app.use(errorHandler);

  return app;
}

export function startServer(app: Application, port: number = Number(PORT)): void {
  const server = app.listen(port, () => {
    console.log(`Express server listening on port ${port}`);
  });

  // Handle graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('Forcing shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Start server if this file is run directly
if (require.main === module) {
  const app = createApp();
  startServer(app);
}
