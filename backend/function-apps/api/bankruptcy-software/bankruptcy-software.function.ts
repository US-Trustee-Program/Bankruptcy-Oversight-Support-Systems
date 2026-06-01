import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import ContextCreator from '../../azure/application-context-creator';
import { createControllerHandler, toAzureError, toAzureSuccess } from '../../azure/functions';
import { BankruptcySoftwareController } from '../../../lib/controllers/bankruptcy-software/bankruptcy-software.controller';
import { SoftwareTrusteesController } from '../../../lib/controllers/software-trustees/software-trustees.controller';
import { SoftwareBankTrusteesController } from '../../../lib/controllers/software-bank-trustees/software-bank-trustees.controller';
import { BankruptcySoftwareHistoryController } from '../../../lib/controllers/bankruptcy-software-history/bankruptcy-software-history.controller';
import { SoftwareTrusteeCountsController } from '../../../lib/controllers/software-trustee-counts/software-trustee-counts.controller';
import { CamsHttpResponseInit } from '../../../lib/adapters/utils/http-response';

const MODULE_NAME = 'BANKRUPTCY-SOFTWARE-FUNCTION';

const handler = createControllerHandler(BankruptcySoftwareController, MODULE_NAME);
export default handler;

export const trusteesHandler = createControllerHandler(SoftwareTrusteesController, MODULE_NAME);

export const bankTrusteesHandler = createControllerHandler(
  SoftwareBankTrusteesController,
  MODULE_NAME,
);

export const historyHandler = createControllerHandler(
  BankruptcySoftwareHistoryController,
  MODULE_NAME,
);

export const trusteeCountsHandler = createControllerHandler(
  SoftwareTrusteeCountsController,
  MODULE_NAME,
);

export async function nameHandler(
  request: HttpRequest,
  invocationContext: InvocationContext,
): Promise<HttpResponseInit> {
  const logger = ContextCreator.getLogger(invocationContext);

  try {
    const context = await ContextCreator.applicationContextCreator({
      invocationContext,
      logger,
      request,
    });

    context.session = await ContextCreator.getApplicationContextSession(context);
    const controller = new BankruptcySoftwareController(context);
    const softwareId = request.params.softwareId;
    const response = await controller.handleGetName(context, softwareId);
    return toAzureSuccess(response as CamsHttpResponseInit);
  } catch (error) {
    return toAzureError(logger, MODULE_NAME, error);
  }
}

app.http('bankruptcy-software', {
  methods: ['GET', 'POST', 'PUT'],
  authLevel: 'anonymous',
  handler,
  route: 'bankruptcy-software/{softwareId?}',
});

app.http('bankruptcy-software-name', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: nameHandler,
  route: 'bankruptcy-software/{softwareId}/name',
});

app.http('bankruptcy-software-trustees', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: trusteesHandler,
  route: 'bankruptcy-software/{softwareId}/trustees',
});

app.http('bankruptcy-software-bank-trustees', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: bankTrusteesHandler,
  route: 'bankruptcy-software/{softwareId}/banks/{bankId}/trustees',
});

app.http('bankruptcy-software-history', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: historyHandler,
  route: 'bankruptcy-software/{softwareId}/history',
});

app.http('bankruptcy-software-trustee-counts', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: trusteeCountsHandler,
  route: 'bankruptcy-software/{softwareId}/trustee-counts',
});
