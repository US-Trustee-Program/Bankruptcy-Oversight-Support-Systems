import * as jwt from 'jsonwebtoken';
import { ApplicationContext } from '../types/basic';
import { CosmosDbRepository } from './cosmos/cosmos.repository';
import { CamsSession } from '../../../../../common/src/cams/session';
import { UserSessionCacheRepository } from './user-session-cache.repository';
import { CamsJwtClaims } from '../types/authorization';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_USER_SESSION_CACHE';
const CONTAINER_NAME: string = 'user-session-cache';

export type CachedCamsSession = CamsSession & {
  id?: string;
  signature: string;
  ttl: number;
};

export class UserSessionCacheCosmosDbRepository implements UserSessionCacheRepository {
  private repo: CosmosDbRepository<CachedCamsSession>;
  constructor(context: ApplicationContext) {
    this.repo = new CosmosDbRepository<CachedCamsSession>(context, CONTAINER_NAME, MODULE_NAME);
  }

  public async get(context: ApplicationContext, token: string): Promise<CamsSession | null> {
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      throw new UnauthorizedError(MODULE_NAME, { message: 'Invalid token received.' });
    }
    const signature = tokenParts[2];
    const query = 'SELECT * FROM c WHERE c.signature = @signature';
    const querySpec = {
      query,
      parameters: [
        {
          name: '@signature',
          value: signature,
        },
      ],
    };

    const cached = await this.repo.query(context, querySpec);
    if (cached && cached.length === 1) {
      return toCamsSession(cached[0]);
    } else {
      return null;
    }
  }

  public async put(context: ApplicationContext, session: CamsSession): Promise<CamsSession> {
    try {
      const tokenParts = session.apiToken.split('.');
      const signature = tokenParts[2];
      const claims = jwt.decode(session.apiToken) as CamsJwtClaims;
      const ttl = Math.floor(claims.exp - Date.now() / 1000);
      const cached: CachedCamsSession = {
        ...session,
        signature,
        ttl,
      };
      return toCamsSession(await this.repo.put(context, cached));
    } catch {
      throw new UnauthorizedError(MODULE_NAME, { message: 'Invalid token received.' });
    }
  }
}

function toCamsSession(cachedSession: CachedCamsSession): CamsSession {
  const { id: _, signature: _s, ttl: _t, ...camsSession } = cachedSession;
  return camsSession;
}
