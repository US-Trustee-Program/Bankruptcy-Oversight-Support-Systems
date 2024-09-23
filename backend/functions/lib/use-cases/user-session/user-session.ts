import {
  getAuthorizationGateway,
  getOfficesGateway,
  getUserSessionCacheRepository,
} from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { isCamsError } from '../../common-errors/cams-error';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { OfficeDetails } from '../../../../../common/src/cams/courts';
import LocalStorageGateway from '../../adapters/gateways/storage/local-storage-gateway';
import { OFFICES } from '../../../../../common/src/cams/test-utilities/offices.mock';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { CamsSession } from '../../../../../common/src/cams/session';

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
): Promise<OfficeDetails[]> {
  const officesMap = LocalStorageGateway.getOfficeMapping();
  const dxtrGroupDesignators = idpGroups
    .filter((idpGroup) => officesMap.has(idpGroup))
    .reduce((groupDesignators, idpGroup) => {
      officesMap.get(idpGroup).forEach((designator) => {
        groupDesignators.add(designator);
      });
      return groupDesignators;
    }, new Set<string>());
  const officesGateway = getOfficesGateway(context);

  const offices: OfficeDetails[] = [];
  for (const designator of dxtrGroupDesignators) {
    try {
      const officesPerDesignator = await officesGateway.getOfficesByGroupDesignator(
        context,
        designator,
      );
      officesPerDesignator.forEach((office) => offices.push(office));
    } catch (error) {
      context.logger.warn(MODULE_NAME, error.message, { designator });
    }
  }
  return offices;
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

      const { user, groups, jwt } = await authGateway.getUser(token);
      user.roles = getRoles(groups);
      user.offices = await getOffices(context, groups);

      // Simulate the legacy behavior by appending roles and Manhattan office to the user
      // if the 'restrict-case-assignment' feature flag is not set.
      if (!context.featureFlags['restrict-case-assignment']) {
        user.offices = [OFFICES.find((office) => office.courtDivisionCode === '081')];
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
    } catch (originalError) {
      if (isConflictError(originalError)) {
        return await sessionCacheRepository.get(context, token);
      }

      if (isCamsError(originalError)) {
        throw originalError;
      }

      throw new UnauthorizedError(MODULE_NAME, {
        message: originalError.message,
        originalError,
      });
    }
  }
}
