import { CamsSession } from '../../../../../common/src/cams/session';
import { SessionCache } from '../utils/sessionCache';
import { getAuthorizationGateway, getUserSessionCacheRepository } from '../../factory';
import { getAuthorizationConfig } from '../../configs/authorization-configuration';
import { ApplicationContext } from '../types/basic';

export class UserSessionGateway implements SessionCache {
  async lookup(context: ApplicationContext, token: string): Promise<CamsSession> {
    const cacheGateway = getUserSessionCacheRepository(context);
    const cached = await cacheGateway.get(context, token);

    if (cached) {
      return cached;
    }

    const { provider } = getAuthorizationConfig();
    const authGateway = getAuthorizationGateway(provider);
    const jwt = await authGateway.verifyToken(token);
    const session: CamsSession = {
      user: { name: '' },
      apiToken: token,
      provider: provider,
      validatedClaims: jwt.claims,
    };
    await cacheGateway.put(context, session);

    return session;
  }
}
