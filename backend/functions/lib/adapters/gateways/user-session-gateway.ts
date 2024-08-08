import { SessionGateway } from '../utils/session-gateway';
import {
  getAuthorizationGateway,
  getOfficesGateway,
  getUserSessionCacheRepository,
} from '../../factory';
import { ApplicationContext } from '../types/basic';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { isCamsError } from '../../common-errors/cams-error';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { OfficeDetails } from '../../../../../common/src/cams/courts';
import LocalStorageGateway from './storage/local-storage-gateway';
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

async function getOffices(context: ApplicationContext, groups: string[]): Promise<OfficeDetails[]> {
  const officesMap = LocalStorageGateway.getOfficeMapping();
  const officeDetailsKeys = groups
    .filter((group) => officesMap.has(group))
    .map((group) => {
      return {
        courtId: officesMap.get(group).courtId,
        officeCode: officesMap.get(group).officeCode,
      };
    });
  const officesGateway = getOfficesGateway(context);
  const officeDetailsArray = officeDetailsKeys.map((detail) => {
    return officesGateway.getOfficeByCourtIdAndOfficeCode(
      context,
      detail.courtId,
      detail.officeCode,
    );
  });
  const returnStuff = Promise.all(officeDetailsArray);
  return returnStuff;
}

export class UserSessionGateway implements SessionGateway {
  async lookup(context: ApplicationContext, token: string, provider: string): Promise<CamsSession> {
    const caseRepository = getUserSessionCacheRepository(context);
    const cached = await caseRepository.get(context, token);

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
      const jwt = await authGateway.verifyToken(token);
      if (!jwt) {
        throw new UnauthorizedError(MODULE_NAME, {
          message: 'Unable to verify token.',
        });
      }
      const user = await authGateway.getUser(token);

      // Simulate the legacy behavior by appending roles and Manhattan office to the user
      // if the 'restrict-case-assignment' feature flag is not set.
      if (context.featureFlags['restrict-case-assignment']) {
        user.roles = getRoles(jwt.claims.groups);
        user.offices = await getOffices(context, jwt.claims.groups);
      } else {
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

      await caseRepository.put(context, session);

      return session;
    } catch (originalError) {
      if (isConflictError(originalError)) {
        return await caseRepository.get(context, token);
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
