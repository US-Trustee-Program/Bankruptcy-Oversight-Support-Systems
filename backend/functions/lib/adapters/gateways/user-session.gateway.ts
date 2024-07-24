import { CamsRole, CamsSession } from '../../../../../common/src/cams/session';
import { SessionCache } from '../utils/sessionCache';
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

export class UserSessionGateway implements SessionCache {
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
      // TODO: map jwt.claims to user.offices and user.roles
      // 1. Check cache
      //   1. cache miss
      //     1. verify token with okta
      //       1. decorate session
      //         1. user
      //           1. call getUser from Okta
      //           1. get roles from local map
      //           1. get offices from local map
      //           1. get office details from DXTR
      //     1. store in cache
      //     1. return session
      //   1. cache hit
      //     1. return session
      const user = await authGateway.getUser(token);

      user.roles = getRoles(jwt.claims.groups);
      user.offices = await getOffices(context, jwt.claims.groups);

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
