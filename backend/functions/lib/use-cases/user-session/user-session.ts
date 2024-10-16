import { getAuthorizationGateway, getUserSessionCacheRepository } from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { isCamsError } from '../../common-errors/cams-error';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { UstpOfficeDetails } from '../../../../../common/src/cams/offices';
import LocalStorageGateway from '../../adapters/gateways/storage/local-storage-gateway';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { CamsSession } from '../../../../../common/src/cams/session';
import { REGION_02_GROUP_NY } from '../../../../../common/src/cams/test-utilities/mock-user';

const MODULE_NAME = 'USER-SESSION-GATEWAY';

export interface ConflictError {
  code: 409;
  body: {
    code: 'Conflict';
    message: string;
  };
  headers: {
    [key: string]: unknown;
  };
  activityId: string;
}

export function isConflictError(error: ConflictError | unknown): error is ConflictError {
  return (
    (<ConflictError>error).code === 409 &&
    (<ConflictError>error).body.code === 'Conflict' &&
    (<ConflictError>error).body.message.includes(
      'Entity with the specified id already exists in the system.',
    )
  );
}

function getRoles(groups: string[]): CamsRole[] {
  const rolesMap = LocalStorageGateway.getRoleMapping();
  return groups.filter((group) => rolesMap.has(group)).map((group) => rolesMap.get(group));
}

async function getOffices(
  context: ApplicationContext,
  idpGroups: string[],
): Promise<UstpOfficeDetails[]> {
  const ustpOffices = LocalStorageGateway.getUstpOffices();
  return ustpOffices.filter((office) => idpGroups.includes(office.idpGroupId));
}

export class UserSessionUseCase {
  async lookup(context: ApplicationContext, token: string, provider: string): Promise<CamsSession> {
    const sessionCacheRepository = getUserSessionCacheRepository(context);
    const cached = await sessionCacheRepository.get(context, token);

    if (cached) {
      return cached;
    }

    try {
      const authGateway = getAuthorizationGateway(context);
      if (!authGateway) {
        throw new ServerConfigError(MODULE_NAME, {
          message: 'Unsupported authentication provider.',
        });
      }

      const { user, jwt } = await authGateway.getUser(token);
      user.roles = getRoles(jwt.claims.groups);
      user.offices = await getOffices(context, jwt.claims.groups);

      // Simulate the legacy behavior by appending roles and Manhattan office to the user
      // if the 'restrict-case-assignment' feature flag is not set.
      if (!context.featureFlags['restrict-case-assignment']) {
        user.offices = [REGION_02_GROUP_NY];
        user.roles = [CamsRole.CaseAssignmentManager];
      }

      const session: CamsSession = {
        user,
        accessToken: token,
        provider: provider,
        expires: jwt.claims.exp,
        issuer: jwt.claims.iss,
      };

      await sessionCacheRepository.put(context, session);

      return session;
    } catch (error) {
      const isConflict = error.originalError
        ? isConflictError(error.originalError)
        : isConflictError(error);
      if (isConflict) {
        return await sessionCacheRepository.get(context, token);
      }

      throw isCamsError(error)
        ? error
        : new UnauthorizedError(MODULE_NAME, {
            message: error.message,
            originalError: error,
          });
    }
  }
}
