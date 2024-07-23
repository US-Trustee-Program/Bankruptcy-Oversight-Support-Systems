import { CamsSession } from '../../../../../common/src/cams/session';
import { SessionCache } from '../utils/sessionCache';
import { getAuthorizationGateway, getUserSessionCacheRepository } from '../../factory';
import { ApplicationContext } from '../types/basic';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { isCamsError } from '../../common-errors/cams-error';
import { ServerConfigError } from '../../common-errors/server-config-error';

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
      const user = await authGateway.getUser(token);
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
