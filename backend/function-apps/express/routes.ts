import { Router, Request, Response } from 'express';
import * as dotenv from 'dotenv';

// Import controllers
import { AttorneysController } from '../../lib/controllers/attorneys/attorneys.controller';
import { CaseAssignmentController } from '../../lib/controllers/case-assignment/case.assignment.controller';
import { CasesController } from '../../lib/controllers/cases/cases.controller';
import { CourtsController } from '../../lib/controllers/courts/courts.controller';
import { MeController } from '../../lib/controllers/me/me.controller';
import { OfficesController } from '../../lib/controllers/offices/offices.controller';
import { OrdersController } from '../../lib/controllers/orders/orders.controller';
import { TrusteesController } from '../../lib/controllers/trustees/trustees.controller';
import { CaseDocketController } from '../../lib/controllers/case-docket/case-docket.controller';
import { CaseHistoryController } from '../../lib/controllers/case-history/case-history.controller';
import { CaseNotesController } from '../../lib/controllers/case-notes/case.notes.controller';
import { CaseSummaryController } from '../../lib/controllers/case-summary/case-summary.controller';
import { CaseAssociatedController } from '../../lib/controllers/case-associated/case-associated.controller';
import { PrivilegedIdentityAdminController } from '../../lib/controllers/admin/privileged-identity-admin.controller';

// Import mock authentication function for oauth2
import { mockAuthentication } from '../../lib/testing/mock-gateways/mock-oauth2-gateway';

// Import healthcheck modules
import HealthcheckCosmosDb from '../api/healthcheck/healthcheck.db.cosmos';
import HealthcheckSqlDb from '../api/healthcheck/healthcheck.db.sql';
import HealthcheckInfo from '../api/healthcheck/healthcheck.info';
import { closeDeferred } from '../../lib/deferrable/defer-close';
import { httpSuccess } from '../../lib/adapters/utils/http-response';
import HttpStatusCodes from '../../../common/src/api/http-status-codes';

// Import Express-specific utilities
import ContextCreator from './application-context-creator';
import { toExpressError, toExpressSuccess } from './functions';
import { ApplicationContext } from '../../lib/adapters/types/basic';

dotenv.config();

// Types
type ControllerConstructor = new (...args: unknown[]) => {
  handleRequest: (context: ApplicationContext) => Promise<unknown>;
};

// Helper function to create Express handler from Azure Function pattern
function createExpressHandler(
  ControllerClass: ControllerConstructor,
  moduleName: string,
  constructorArgs?: (context: ApplicationContext) => unknown[],
) {
  return async (req: Request, res: Response) => {
    try {
      const context = await ContextCreator.applicationContextCreator({
        request: req,
        invocationId: req.headers['x-request-id'] as string,
      });

      const args = constructorArgs ? constructorArgs(context) : [];
      const controller = new ControllerClass(...args);
      const response = await controller.handleRequest(context);
      toExpressSuccess(res, response);
    } catch (error) {
      toExpressError(res, ContextCreator.getLogger(), moduleName, error as Error);
    }
  };
}

// Create router
const router = Router();

// Health check endpoint - special case without authentication context
router.get('/healthcheck', async (req: Request, res: Response) => {
  const MODULE_NAME = 'HEALTHCHECK';
  try {
    const context = await ContextCreator.getApplicationContext({
      request: req,
      invocationId: req.headers['x-request-id'] as string,
    });

    const healthcheckCosmosDbClient = new HealthcheckCosmosDb(context);
    const healthCheckSqlDbClient = new HealthcheckSqlDb(context);

    context.logger.debug(MODULE_NAME, 'Health check endpoint invoked');

    const cosmosStatus = await healthcheckCosmosDbClient.checkDocumentDb();
    Object.keys(cosmosStatus).forEach((key) => {
      context.logger.debug(MODULE_NAME, key + ': ' + cosmosStatus[key]);
    });

    const checkSqlDbReadAccess = await healthCheckSqlDbClient.checkDxtrDbRead();
    context.logger.debug(MODULE_NAME, 'SQL Dxtr Db Read Check return ' + checkSqlDbReadAccess);

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

    // Check if all health checks passed
    const success = [
      cosmosStatus.cosmosDbDeleteStatus,
      cosmosStatus.cosmosDbReadStatus,
      cosmosStatus.cosmosDbWriteStatus,
      checkSqlDbReadAccess,
    ].every(Boolean);

    toExpressSuccess(
      res,
      httpSuccess({
        body: {
          data: { status: success ? 'OK' : 'ERROR', ...respBody },
        },
        statusCode: success ? HttpStatusCodes.OK : HttpStatusCodes.INTERNAL_SERVER_ERROR,
      }),
    );
  } catch (error) {
    toExpressError(res, ContextCreator.getLogger(), MODULE_NAME, error as Error);
  }
});

// Standard API routes
router.get('/attorneys/:id?', createExpressHandler(AttorneysController, 'ATTORNEYS-FUNCTION'));

router.get(
  '/case-assignments/:id?',
  createExpressHandler(CaseAssignmentController, 'CASE-ASSIGNMENT-FUNCTION', (context) => [
    context,
  ]),
);
router.post(
  '/case-assignments/:id?',
  createExpressHandler(CaseAssignmentController, 'CASE-ASSIGNMENT-FUNCTION', (context) => [
    context,
  ]),
);

router.get(
  '/cases/:caseId?/associated',
  createExpressHandler(CaseAssociatedController, 'CASE-ASSOCIATED-FUNCTION'),
);

router.get(
  '/cases/:caseId?/docket',
  createExpressHandler(CaseDocketController, 'CASE-DOCKET-FUNCTION', (context) => [context]),
);

router.get(
  '/cases/:id?/history',
  createExpressHandler(CaseHistoryController, 'CASE-HISTORY-FUNCTION'),
);

router.get(
  '/cases/:caseId/notes/:noteId?/:userId?',
  createExpressHandler(CaseNotesController, 'CASE-NOTES-FUNCTION', (context) => [context]),
);
router.post(
  '/cases/:caseId/notes/:noteId?/:userId?',
  createExpressHandler(CaseNotesController, 'CASE-NOTES-FUNCTION', (context) => [context]),
);
router.put(
  '/cases/:caseId/notes/:noteId?/:userId?',
  createExpressHandler(CaseNotesController, 'CASE-NOTES-FUNCTION', (context) => [context]),
);
router.delete(
  '/cases/:caseId/notes/:noteId?/:userId?',
  createExpressHandler(CaseNotesController, 'CASE-NOTES-FUNCTION', (context) => [context]),
);

router.get(
  '/cases/:caseId?/summary',
  createExpressHandler(CaseSummaryController, 'CASE-SUMMARY-FUNCTION', (context) => [context]),
);

router.get(
  '/cases/:caseId?',
  createExpressHandler(CasesController, 'CASES-FUNCTION', (context) => [context]),
);
router.post(
  '/cases/:caseId?',
  createExpressHandler(CasesController, 'CASES-FUNCTION', (context) => [context]),
);

router.put(
  '/consolidations/:procedure',
  createExpressHandler(OrdersController, 'CONSOLIDATIONS-FUNCTION', (context) => [context]),
);

router.get('/courts', createExpressHandler(CourtsController, 'COURTS-FUNCTION'));

router.get('/me', createExpressHandler(MeController, 'ME-FUNCTION'));

router.get(
  '/offices/:officeCode?/:subResource?',
  createExpressHandler(OfficesController, 'OFFICES-FUNCTION'),
);

router.get(
  '/orders/:id?',
  createExpressHandler(OrdersController, 'ORDERS-FUNCTION', (context) => [context]),
);
router.patch(
  '/orders/:id?',
  createExpressHandler(OrdersController, 'ORDERS-FUNCTION', (context) => [context]),
);

router.get(
  '/orders-suggestions/:caseId?',
  createExpressHandler(OrdersController, 'ORDERS-SUGGESTIONS-FUNCTION', (context) => [context]),
);

router.get(
  '/trustees/:id?',
  createExpressHandler(TrusteesController, 'TRUSTEES-FUNCTION', (context) => [context]),
);
router.post(
  '/trustees/:id?',
  createExpressHandler(TrusteesController, 'TRUSTEES-FUNCTION', (context) => [context]),
);

// Admin routes
router.delete(
  '/dev-tools/privileged-identity/:resourceId?',
  createExpressHandler(PrivilegedIdentityAdminController, 'PRIVILEGED-IDENTITY-ADMIN-FUNCTION'),
);
router.get(
  '/dev-tools/privileged-identity/:resourceId?',
  createExpressHandler(PrivilegedIdentityAdminController, 'PRIVILEGED-IDENTITY-ADMIN-FUNCTION'),
);
router.put(
  '/dev-tools/privileged-identity/:resourceId?',
  createExpressHandler(PrivilegedIdentityAdminController, 'PRIVILEGED-IDENTITY-ADMIN-FUNCTION'),
);

// OAuth2 mock endpoint - special case using direct function call
router.post('/oauth2/default', async (req: Request, res: Response) => {
  const MODULE_NAME = 'MOCK-OAUTH2-FUNCTION';
  try {
    const context = await ContextCreator.getApplicationContext({
      request: req,
      invocationId: req.headers['x-request-id'] as string,
    });

    const token = await mockAuthentication(context);
    toExpressSuccess(
      res,
      httpSuccess({
        body: { data: { value: token } },
      }),
    );
  } catch (error) {
    toExpressError(res, ContextCreator.getLogger(), MODULE_NAME, error as Error);
  }
});

export default router;
