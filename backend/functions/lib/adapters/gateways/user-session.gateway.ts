import { CamsSession } from '../../../../../common/src/cams/session';
import { SessionCache } from '../utils/sessionCache';
import { getAuthorizationGateway } from '../../factory';
import { getAuthorizationConfig } from '../../configs/authorization-configuration';

export class UserSessionGateway implements SessionCache {
  async lookup(token: string): Promise<CamsSession> {
    // check if token has been validated (i.e. is there a cache hit)
    // const cacheGateway = get
    // return CamsSession if exists
    // validate with Okta if it doesn't exist
    const { provider } = getAuthorizationConfig();
    const authGateway = getAuthorizationGateway(provider);
    const jwt = await authGateway.verifyToken(token);
    const session: CamsSession = {
      user: { name: '' },
      apiToken: token,
      provider: '',
      validatedClaims: jwt.claims,
    };
    // if valid hydrate cache
    // if invalid throw or return something?
    // throw new Error('Not Implemented...');
    return Promise.resolve(session);
  }
}
