import * as dotenv from 'dotenv';
import express, { Application, Request, Response, NextFunction } from 'express';
import ContextCreator from './application-context-creator';
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
import { TrusteeAppointmentsController } from '../lib/controllers/trustee-appointments/trustee-appointments.controller';
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

const PORT = Number.parseInt(process.env.PORT) || 7071;

export function checkResults(...results: boolean[]) {
  return results.every((result) => result);
}

export function createApp(): Application {
  const app = express();

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    next();
  });

  app.use(express.json());

  app.get('/api/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);
      const controller = new MeController();
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  });

  const handleCases = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);
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

  const handleCaseAssignments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);
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

  const handleCaseDocket = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);
      const controller = new CaseDocketController(context);
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/cases/:caseId/docket', handleCaseDocket);

  const handleCaseHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);
      const controller = new CaseHistoryController();
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/cases/:id/history', handleCaseHistory);

  const handleCaseNotes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);
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

  const handleCaseSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);
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

  const handleCaseAssociated = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);
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

  const handleOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);
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

  const handleOrdersSuggestions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);
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

  const handleConsolidations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);
      const controller = new OrdersController(context);
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.put('/api/consolidations/:procedure', handleConsolidations);

  const handleTrustees = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);
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

  const handleTrusteeAppointments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);
      const controller = new TrusteeAppointmentsController(context);
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/trustee-appointments', handleTrusteeAppointments);
  app.get('/api/trustee-appointments/:id', handleTrusteeAppointments);

  const handleTrusteeAssignments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);
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

  const handleTrusteeHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);
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

  const handleOffices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);
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

  const handleCourts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);
      const controller = new CourtsController();
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/courts', handleCourts);

  const handleStaff = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);
      const controller = new StaffController(context);
      const camsResponse = await controller.handleRequest(context);
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  };

  app.get('/api/staff', handleStaff);

  const handleLists = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);
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

  const handlePrivilegedIdentityAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);
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

  app.post('/api/oauth2/default', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestId = `express-${Date.now()}-${Math.random()}`;
      const logger = ContextCreator.getLogger(requestId);
      const context = await ContextCreator.getApplicationContext<{
        username?: string;
        password?: string;
        sub?: string;
      }>(req, logger, requestId);

      const token: string = await mockAuthentication(context);

      const camsResponse = httpSuccess({
        body: { data: { value: token } },
      });
      sendCamsResponse(res, camsResponse);
      await finalizeDeferrable(context);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/healthcheck', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await ContextCreator.applicationContextCreator(req);

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

  app.use(errorHandler);

  return app;
}

export function startServer(app: Application, port: number = Number(PORT)): void {
  const server = app.listen(port, () => {
    console.log(`Express server listening on port ${port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('Forcing shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  const app = createApp();
  startServer(app);
}
