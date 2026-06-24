import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { CamsController } from '../controller';
import { BadRequestError } from '../../common-errors/bad-request';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { CamsRole } from '@common/cams/roles';
import HttpStatusCodes from '@common/api/http-status-codes';
import { NotificationRoutingRepository } from '../../use-cases/gateways.types';
import {
  NotificationRoutingInput,
  NotificationRoutingRecord,
  NotificationConfig,
} from '@common/cams/notifications';
import factory from '../../factory';

const MODULE_NAME = 'NOTIFICATION-ROUTING-CONTROLLER';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class NotificationRoutingController implements CamsController {
  private readonly repository: NotificationRoutingRepository;

  constructor(context: ApplicationContext) {
    this.repository = factory.getNotificationRoutingRepository(context);
  }

  async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<object | undefined>> {
    this.requireSuperUser(context);

    const { method } = context.request;
    const { routingId } = context.request.params;

    if (method === 'GET' && routingId === 'config') {
      return this.handleGetConfig(context);
    } else if (method === 'GET') {
      return this.handleGet(context);
    } else if (method === 'POST') {
      return this.handlePost(context);
    } else if (method === 'PUT' && routingId === 'config') {
      return this.handlePutConfig(context);
    } else if (method === 'PUT' && routingId) {
      return this.handlePut(context);
    } else if (method === 'DELETE' && routingId) {
      return this.handleDelete(context);
    } else if (method === 'DELETE') {
      throw new BadRequestError(MODULE_NAME, { message: 'Routing ID is required for delete.' });
    }

    return httpSuccess({ statusCode: HttpStatusCodes.METHOD_NOT_ALLOWED }) as CamsHttpResponseInit;
  }

  private async handleGet(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<NotificationRoutingRecord[]>> {
    const records = await this.repository.getAll();
    return httpSuccess({
      statusCode: HttpStatusCodes.OK,
      body: { meta: { self: context.request.url }, data: records },
    });
  }

  private async handleGetConfig(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<NotificationConfig>> {
    const config = await this.repository.getConfig();
    return httpSuccess({
      statusCode: HttpStatusCodes.OK,
      body: { meta: { self: context.request.url }, data: config },
    });
  }

  private async handlePost(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<NotificationRoutingRecord>> {
    const input = this.validateRoutingInput(context.request.body);
    const record = await this.repository.create(input);
    return httpSuccess({
      statusCode: HttpStatusCodes.CREATED,
      body: { meta: { self: context.request.url }, data: record },
    });
  }

  private async handlePut(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<NotificationRoutingRecord>> {
    const { routingId } = context.request.params;
    const input = this.validateRoutingInput(context.request.body);
    const record = await this.repository.update(routingId, input);
    return httpSuccess({
      statusCode: HttpStatusCodes.OK,
      body: { meta: { self: context.request.url }, data: record },
    });
  }

  private async handlePutConfig(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<NotificationConfig>> {
    const body = context.request.body as { enabled?: unknown } | null;
    if (!body || typeof body.enabled !== 'boolean') {
      throw new BadRequestError(MODULE_NAME, {
        message: 'Config body must include a boolean "enabled" field.',
      });
    }
    const config = await this.repository.updateConfig({ enabled: body.enabled });
    return httpSuccess({
      statusCode: HttpStatusCodes.OK,
      body: { meta: { self: context.request.url }, data: config },
    });
  }

  private async handleDelete(context: ApplicationContext): Promise<CamsHttpResponseInit> {
    const { routingId } = context.request.params;
    await this.repository.delete(routingId);
    return httpSuccess({ statusCode: HttpStatusCodes.NO_CONTENT }) as CamsHttpResponseInit;
  }

  private validateRoutingInput(body: unknown): NotificationRoutingInput {
    const input = body as { key?: string; recipientAddress?: string; displayName?: string } | null;
    if (!input) {
      throw new BadRequestError(MODULE_NAME, { message: 'Request body is required.' });
    }
    if (!input.key || !input.key.trim()) {
      throw new BadRequestError(MODULE_NAME, { message: 'Key is required.' });
    }
    if (!input.recipientAddress || !EMAIL_REGEX.test(input.recipientAddress)) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'A valid recipient email address is required.',
      });
    }
    const result: NotificationRoutingInput = {
      key: input.key.trim(),
      recipientAddress: input.recipientAddress.trim(),
    };
    if (input.displayName) {
      result.displayName = input.displayName.trim();
    }
    return result;
  }

  private requireSuperUser(context: ApplicationContext): void {
    if (!context.session.user.roles?.includes(CamsRole.SuperUser)) {
      throw new ForbiddenError(MODULE_NAME);
    }
  }
}
