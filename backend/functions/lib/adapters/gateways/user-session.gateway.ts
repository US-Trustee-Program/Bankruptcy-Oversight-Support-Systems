import { CamsSession } from '../../../../../common/src/cams/session';
import { SessionCache } from '../utils/sessionCache';
import { getAuthorizationGateway, getUserSessionCacheRepository } from '../../factory';
import { ApplicationContext } from '../types/basic';
import { ForbiddenError } from '../../common-errors/forbidden-error';

const MODULE_NAME = 'USER-SESSION-GATEWAY';

export class UserSessionGateway implements SessionCache {
  async lookup(context: ApplicationContext, token: string, provider: string): Promise<CamsSession> {
    const cacheGateway = getUserSessionCacheRepository(context);
    const cached = await cacheGateway.get(context, token);

    if (cached) {
      return cached;
    }

    const authGateway = getAuthorizationGateway(provider);
    const jwt = await authGateway.verifyToken(token);
    if (!jwt) {
      throw new ForbiddenError(MODULE_NAME, {
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
  }
}
