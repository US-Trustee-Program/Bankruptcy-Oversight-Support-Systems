import { CamsRole } from '@common/cams/roles';
import {
  CamsUserWithPermissions,
  PermissionChange,
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
const DEFAULT_PAGE_LIMIT = 20;
const DEFAULT_PAGE_OFFSET = 0;

function parseQueryInt(value: unknown, fallback: number, isValid: (n: number) => boolean) {
  const parsed = parseInt(value as string);
  return Number.isFinite(parsed) && isValid(parsed) ? parsed : fallback;
}

// Typed as `unknown` because this actually receives whatever Express's `req.query` holds for the
// key: usually a string, but an array when the key repeats (e.g. `?name=a&name=b`), which a plain
// `string | undefined` parameter would accept and then crash on `.trim()`. Azure Functions' query
// parsing never produces an array, so this only matters for the Express dev server.
function optionalTrimmedString(value: unknown): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' ? first.trim() || undefined : undefined;
}

function pagingFrom(context: ApplicationContext) {
  const { query } = context.request;
  return {
    limit: parseQueryInt(query.limit, DEFAULT_PAGE_LIMIT, (n) => n > 0),
    offset: parseQueryInt(query.offset, DEFAULT_PAGE_OFFSET, (n) => n >= 0),
  };
}

// Change History rejects bad paging rather than defaulting it: an absent value takes the default,
// and anything else goes to the use case unaltered (NaN when not a number) for it to validate.
function strictPagingFrom(context: ApplicationContext) {
  const { limit, offset } = context.request.query;
  return {
    limit: limit === undefined ? DEFAULT_PAGE_LIMIT : Number(limit),
    offset: offset === undefined ? DEFAULT_PAGE_OFFSET : Number(offset),
  };
}

/** The permission named by users/:userId/permissions/:role/:regionId/:officeCode. */
function permissionFromPath(context: ApplicationContext): RoleAssignmentGrantRequest {
  const { userId, role, regionId, officeCode } = context.request.params;
  // The use case validates the request before using it.
  return { userId, role, regionId, officeCode } as RoleAssignmentGrantRequest;
}

export class UserAccessController implements CamsController {
  private readonly useCase: UserAccessUseCase;

  constructor(context: ApplicationContext) {
    this.useCase = new UserAccessUseCase(context);
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<
    CamsHttpResponseInit<CamsUserWithPermissions[] | PermissionChange[] | RoleAssignmentGrantResult>
  > {
    try {
      this.requireAccess(context);

      const { method, params } = context.request;

      if (method === 'GET' && params.resource === 'users') {
        return await this.getUsers(context);
      } else if (method === 'GET' && params.resource === 'changes') {
        return await this.getPermissionChanges(context);
      } else if (method === 'PUT' && params.role) {
        return await this.grantPermission(context);
      } else if (method === 'DELETE' && params.permissionId) {
        return await this.removePermission(context);
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

  /** PUT users/:userId/permissions/:role/:regionId/:officeCode. */
  private async grantPermission(context: ApplicationContext) {
    const request = permissionFromPath(context);
    const { result, created } = await this.useCase.grantPermission(context, request);
    return httpSuccess({ statusCode: created ? 201 : 200, body: { data: result } });
  }

  /** DELETE users/:userId/permissions/:permissionId. */
  private async removePermission(context: ApplicationContext) {
    const { userId, permissionId } = context.request.params;
    // The use case validates the request before using it.
    await this.useCase.removePermission(context, { userId, permissionId });
    return httpSuccess({ statusCode: 204 });
  }

  /** GET changes: Change History, newest first. */
  private async getPermissionChanges(context: ApplicationContext) {
    const { limit, offset } = strictPagingFrom(context);
    const { data, totalCount } = await this.useCase.getPermissionChanges(context, {
      limit,
      offset,
    });
    return httpSuccess({
      body: {
        meta: { self: context.request.url },
        pagination: calculatePagination(data.length, totalCount, limit, offset),
        data,
      },
    });
  }

  private async getUsers(context: ApplicationContext) {
    const { query } = context.request;
    const { limit, offset } = pagingFrom(context);

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
