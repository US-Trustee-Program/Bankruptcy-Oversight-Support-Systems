import * as jwt from 'jsonwebtoken';
import { ApplicationContext } from '../../types/basic';
import { CamsSession } from '../../../../../common/src/cams/session';
import { UnauthorizedError } from '../../../common-errors/unauthorized-error';
import { CamsJwtClaims } from '../../../../../common/src/cams/jwt';
import { getCamsError } from '../../../common-errors/error-utilities';
import QueryBuilder from '../../../query/query-builder';
import { UserSessionCacheRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import DateHelper from '../../../../../common/src/date-helper';

const MODULE_NAME = 'USER-SESSION-CACHE-MONGO-REPOSITORY';
const COLLECTION_NAME: string = 'user-session-cache';

const doc = QueryBuilder.using<CachedCamsSession>();

export type CachedCamsSession = CamsSession & {
  id?: string;
  signature: string;
  ttl: number;
};

export class UserSessionCacheMongoRepository
  extends BaseMongoRepository
  implements UserSessionCacheRepository
{
  private static referenceCount: number = 0;
  private static instance: UserSessionCacheMongoRepository;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!UserSessionCacheMongoRepository.instance) {
      UserSessionCacheMongoRepository.instance = new UserSessionCacheMongoRepository(context);
    }
    UserSessionCacheMongoRepository.referenceCount++;
    return UserSessionCacheMongoRepository.instance;
  }

  public static dropInstance() {
    if (UserSessionCacheMongoRepository.referenceCount > 0) {
      UserSessionCacheMongoRepository.referenceCount--;
    }
    if (UserSessionCacheMongoRepository.referenceCount < 1) {
      UserSessionCacheMongoRepository.instance?.client.close().then();
      UserSessionCacheMongoRepository.instance = null;
    }
  }

  public release() {
    UserSessionCacheMongoRepository.dropInstance();
  }

  public async read(token: string): Promise<CamsSession> {
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      throw new UnauthorizedError(MODULE_NAME, { message: 'Invalid token received.' });
    }
    const signature = tokenParts[2];
    const query = doc('signature').equals(signature);

    try {
      const adapter = this.getAdapter<CachedCamsSession>();
      return toCamsSession(await adapter.findOne(query));
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async upsert(session: CamsSession): Promise<CamsSession> {
    const claims = jwt.decode(session.accessToken) as CamsJwtClaims;

    let signature;
    let ttl;
    try {
      const tokenParts = session.accessToken.split('.');
      ttl = Math.floor(claims.exp - DateHelper.nowInSeconds());
      signature = tokenParts[2];
    } catch {
      throw new UnauthorizedError(MODULE_NAME, { message: 'Invalid token received.' });
    }

    try {
      const query = doc('signature').equals(signature);
      const cached: CachedCamsSession = {
        ...session,
        signature,
        ttl,
      };
      const adapter = this.getAdapter<CachedCamsSession>();
      await adapter.replaceOne(query, cached, true);
      return session;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}

function toCamsSession(cachedSession: CachedCamsSession): CamsSession {
  const { id: _, signature: _s, ttl: _t, ...camsSession } = cachedSession;
  return camsSession;
}
