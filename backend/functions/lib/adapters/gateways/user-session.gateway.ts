import { CamsSession } from '../../../../../common/src/cams/session';
import { SessionCache } from '../utils/sessionCache';
import { getAuthorizationGateway, getUserSessionCacheRepository } from '../../factory';
import { ApplicationContext } from '../types/basic';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';

const MODULE_NAME = 'USER-SESSION-GATEWAY';

export class UserSessionGateway implements SessionCache {
  async lookup(context: ApplicationContext, token: string, provider: string): Promise<CamsSession> {
    const cacheGateway = getUserSessionCacheRepository(context);
    const cached = await cacheGateway.get(context, token);

    if (cached) {
      return cached;
    }

    try {
      const authGateway = getAuthorizationGateway(provider);
      const jwt = await authGateway.verifyToken(token);
      if (!jwt) {
        throw new UnauthorizedError(MODULE_NAME, {
          message: 'Unable to verify token.',
        });
      }
      const user = await authGateway.getUser(token);
      const session: CamsSession = {
        user,
        apiToken: token,
        provider: provider,
        validatedClaims: jwt.claims,
      };
      await cacheGateway.put(context, session);

      return session;
    } catch (originalError) {
      // TODO: Correct the error handling here to look for conflict error and retry and catch any other error from the GET otherwise throw the ForbiddenError(originalError)
      const cached = await cacheGateway.get(context, token);

      if (cached) {
        return cached;
      }
      throw new UnauthorizedError(MODULE_NAME, {
        message:
          'Yeah this was a retry and we failed again. Oh and the GET could have cause and error so the original Error may not be true...',
        originalError,
      });
    }
  }
}
