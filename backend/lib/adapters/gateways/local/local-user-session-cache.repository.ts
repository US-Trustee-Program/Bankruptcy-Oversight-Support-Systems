import * as jwt from 'jsonwebtoken';
import { UserSessionCacheRepository } from '../../../use-cases/gateways.types';
import { CamsSession } from '../../../../../common/src/cams/session';
import { ApplicationContext } from '../../types/basic';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { CamsJwtClaims } from '../../../../../common/src/cams/jwt';

export class LocalUserSessionCacheRepository implements UserSessionCacheRepository {
  cache: Map<string, CamsSession>;

  private static referenceCount: number = 0;
  private static instance: LocalUserSessionCacheRepository;

  constructor(_context: ApplicationContext) {
    this.cache = new Map<string, CamsSession>();
  }

  public static getInstance(_context: ApplicationContext) {
    if (!LocalUserSessionCacheRepository.instance) {
      LocalUserSessionCacheRepository.instance = new LocalUserSessionCacheRepository(_context);
    }
    LocalUserSessionCacheRepository.referenceCount++;
    return LocalUserSessionCacheRepository.instance;
  }

  private static dropInstance() {
    if (LocalUserSessionCacheRepository.referenceCount > 0) {
      LocalUserSessionCacheRepository.referenceCount--;
    }
    if (LocalUserSessionCacheRepository.referenceCount < 1) {
      LocalUserSessionCacheRepository.instance = null;
    }
  }

  public release() {
    LocalUserSessionCacheRepository.dropInstance();
  }

  public read(_id: string, key?: string): Promise<CamsSession> {
    if (this.cache.has(key)) {
      return Promise.resolve(this.cache.get(key));
    }

    throw new NotFoundError('mock');
  }

  public upsert(data: CamsSession): Promise<CamsSession> {
    const { user, provider, accessToken } = data;
    const key = accessToken.split('.')[2];
    const { iss: issuer, exp: expires } = jwt.decode(accessToken) as CamsJwtClaims;
    const cacheEntry: CamsSession = { user, provider, accessToken, expires, issuer };
    this.cache.set(key, cacheEntry);

    return Promise.resolve(cacheEntry);
  }
}
