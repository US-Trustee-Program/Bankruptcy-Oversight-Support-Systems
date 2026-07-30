import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { CamsController } from '../controller';
import { BadRequestError } from '../../common-errors/bad-request';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { CamsRole } from '@common/cams/roles';
import HttpStatusCodes from '@common/api/http-status-codes';
import {
  DomainVerificationGateway,
  NotificationRoutingRepository,
} from '../../use-cases/gateways.types';
import {
  NotificationRoutingRecord,
  NotificationRoutingUpdateInput,
  NOTIFICATION_ROUTING_DEFINITIONS,
} from '@common/cams/notifications';
import { EMAIL_REGEX } from '@common/cams/regex';
import factory from '../../factory';

const MODULE_NAME = 'NOTIFICATION-ROUTING-CONTROLLER';
const MAX_RECIPIENT_ADDRESSES = 50;

export class NotificationRoutingController implements CamsController {
  private readonly repository: NotificationRoutingRepository;
  private readonly domainVerificationGateway: DomainVerificationGateway;

  constructor(context: ApplicationContext) {
    this.repository = factory.getNotificationRoutingRepository(context);
    this.domainVerificationGateway = factory.getDomainVerificationGateway();
  }

  async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<object | undefined>> {
    this.requireSuperUser(context);

    const { method } = context.request;
    const { routingId } = context.request.params;

    if (method === 'GET') {
      return this.handleGet(context);
    } else if (method === 'PUT' && routingId) {
      return this.handlePut(context);
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

  private async handlePut(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<NotificationRoutingRecord>> {
    const { routingId } = context.request.params;
    if (!NOTIFICATION_ROUTING_DEFINITIONS.some((d) => d.id === routingId)) {
      throw new BadRequestError(MODULE_NAME, {
        message: `Unknown routing ID: '${routingId}'. Must be one of: ${NOTIFICATION_ROUTING_DEFINITIONS.map((d) => d.id).join(', ')}`,
      });
    }

    const input = this.validateUpdateInput(context.request.body);
    const { warnings } = await this.validateDomains(context, input.recipientAddresses);

    const definition = NOTIFICATION_ROUTING_DEFINITIONS.find((d) => d.id === routingId)!;
    const existing = await this.repository.findRecipientByRoutingKey(definition.covers[0]);
    const record = await this.repository.updateRoutingRecord(routingId, input);
    await this.repository.createRoutingAuditRecord({
      documentType: 'AUDIT_NOTIFICATION_ROUTING',
      routingRecordId: routingId,
      before: existing?.recipientAddresses?.join(', ') ?? '',
      after: input.recipientAddresses.join(', '),
      updatedOn: new Date().toISOString(),
      updatedBy: { id: context.session.user.id, name: context.session.user.name },
    });
    return httpSuccess({
      statusCode: HttpStatusCodes.OK,
      body: {
        meta: { self: context.request.url },
        data: record,
        ...(warnings.length > 0 ? { warnings } : {}),
      },
    });
  }

  private validateUpdateInput(body: unknown): NotificationRoutingUpdateInput {
    const input = body as { recipientAddresses?: unknown } | null;
    if (!input) {
      throw new BadRequestError(MODULE_NAME, { message: 'Request body is required.' });
    }
    if (!Array.isArray(input.recipientAddresses)) {
      throw new BadRequestError(MODULE_NAME, {
        message: 'recipientAddresses must be an array.',
      });
    }
    if (input.recipientAddresses.length > MAX_RECIPIENT_ADDRESSES) {
      throw new BadRequestError(MODULE_NAME, {
        message: `recipientAddresses must contain at most ${MAX_RECIPIENT_ADDRESSES} addresses; received ${input.recipientAddresses.length}.`,
      });
    }
    const nonStrings = input.recipientAddresses.filter((a) => typeof a !== 'string');
    if (nonStrings.length > 0) {
      throw new BadRequestError(MODULE_NAME, {
        message: `recipientAddresses must contain only string values. Invalid entries: ${nonStrings.map((a) => JSON.stringify(a)).join(', ')}`,
      });
    }
    const trimmed = (input.recipientAddresses as string[]).map((a) => a.trim());
    const invalid = trimmed.filter((a) => !EMAIL_REGEX.test(a));
    if (invalid.length > 0) {
      throw new BadRequestError(MODULE_NAME, {
        message: `Invalid email address(es): ${invalid.join(', ')}`,
      });
    }

    return { recipientAddresses: trimmed };
  }

  private async validateDomains(
    context: ApplicationContext,
    addresses: string[],
  ): Promise<{ warnings: string[] }> {
    const { invalidDomains, warnings } = await this.checkDomains(context, addresses);
    if (invalidDomains.length > 0) {
      throw new BadRequestError(MODULE_NAME, {
        message: `Domain(s) do not appear to accept email and were rejected: ${invalidDomains.join(', ')}`,
      });
    }
    return { warnings };
  }

  private async checkDomains(
    context: ApplicationContext,
    addresses: string[],
  ): Promise<{ invalidDomains: string[]; warnings: string[] }> {
    const domains = this.extractDomains(addresses);
    const results = await Promise.all(
      domains.map(
        async (domain) =>
          [domain, await this.domainVerificationGateway.verifyMailDomain(domain)] as const,
      ),
    );

    const invalidDomains: string[] = [];
    const warnings: string[] = [];
    for (const [domain, result] of results) {
      if (result === 'not-found') {
        invalidDomains.push(domain);
      } else if (result === 'indeterminate') {
        const message = this.buildDomainWarning(domain);
        context.logger.warn(MODULE_NAME, message);
        warnings.push(message);
      }
    }

    return { invalidDomains, warnings };
  }

  private extractDomains(addresses: string[]): string[] {
    return Array.from(
      new Set(
        addresses.map((address) => address.slice(address.lastIndexOf('@') + 1).toLowerCase()),
      ),
    );
  }

  private buildDomainWarning(domain: string): string {
    return `Could not verify that the domain '${domain}' accepts email; the DNS lookup failed rather than confirming the domain doesn't exist. Saved without domain verification for this address.`;
  }

  private requireSuperUser(context: ApplicationContext): void {
    if (!context.session.user.roles?.includes(CamsRole.SuperUser)) {
      throw new ForbiddenError(MODULE_NAME);
    }
  }
}
