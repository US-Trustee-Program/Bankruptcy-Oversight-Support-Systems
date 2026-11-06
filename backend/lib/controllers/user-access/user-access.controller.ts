import { CamsRole } from '@common/cams/roles';
import {
  CamsUserWithPermissions,
  RoleAssignmentGrantRequest,
  RoleAssignmentGrantResult,
} from '@common/cams/user-access';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { BadRequestError } from '../../common-errors/bad-request';
import { getCamsError } from '../../common-errors/error-utilities';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { UserAccessUseCase } from '../../use-cases/user-access/user-access';
import { CamsController } from '../controller';
import { calculatePagination } from '../pagination';

const MODULE_NAME = 'USER-ACCESS-CONTROLLER';
const DEFAULT_USERS_LIMIT = 20;
const DEFAULT_USERS_OFFSET = 0;

function parseQueryInt(value: unknown, fallback: number, isValid: (n: number) => boolean) {
  const parsed = parseInt(value as string);
  return Number.isFinite(parsed) && isValid(parsed) ? parsed : fallback;
}

function optionalTrimmedString(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

export class UserAccessController implements CamsController {
  private readonly useCase: UserAccessUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new UserAccessUseCase(context);
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<CamsUserWithPermissions[] | RoleAssignmentGrantResult>> {
    try {
      this.requireAccess(context);

      const { method, params } = context.request;

      if (method === 'GET' && params.resource === 'users') {
        return await this.getUsers(context);
      } else if (method === 'PUT' && params.role) {
        return await this.grantPermission(context);
      } else {
        throw new BadRequestError(MODULE_NAME, { message: 'Unsupported HTTP Method' });
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }

  private requireAccess(context: ApplicationContext) {
    if (
      !context.featureFlags['cams-role-assignments'] ||
      !context.session.user.roles?.includes(CamsRole.SuperUser)
    ) {
      throw new ForbiddenError(MODULE_NAME);
    }
  }

  /** PUT users/:userId/permissions/:role/:regionId/:officeCode, with { reason } in the body. */
  private async grantPermission(context: ApplicationContext) {
    const { userId, role, regionId, officeCode } = context.request.params;
    const body = context.request.body as { reason?: unknown } | undefined;
    // The use case validates the request before using it.
    const request = {
      userId,
      role,
      regionId,
      officeCode,
      reason: body?.reason,
    } as RoleAssignmentGrantRequest;
    const { result, created } = await this.useCase.grantPermission(context, request);
    return httpSuccess({ statusCode: created ? 201 : 200, body: { data: result } });
  }

  private async getUsers(context: ApplicationContext) {
    const { query } = context.request;
    const limit = parseQueryInt(query.limit, DEFAULT_USERS_LIMIT, (n) => n > 0);
    const offset = parseQueryInt(query.offset, DEFAULT_USERS_OFFSET, (n) => n >= 0);

    const { data, totalCount } = await this.useCase.getCamsUsers(context, {
      limit,
      offset,
      name: optionalTrimmedString(query.name),
      email: optionalTrimmedString(query.email),
    });

    return httpSuccess({
      body: {
        meta: { self: context.request.url },
        pagination: calculatePagination(data.length, totalCount, limit, offset),
        data,
      },
    });
  }
}
