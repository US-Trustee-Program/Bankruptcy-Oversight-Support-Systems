import { CamsSession } from '../../../../common/src/cams/session';
import { UserSessionCacheRepository } from '../../use-cases/gateways.types';
import * as jwt from 'jsonwebtoken';
import { CamsJwtClaims } from '../../../../common/src/cams/jwt';
import { NotFoundError } from '../../common-errors/not-found-error';
import { ApplicationContext } from '../../adapters/types/basic';

export class MockUserSessionCacheRepository implements UserSessionCacheRepository {
  cache: Map<string, CamsSession>;

  private static referenceCount: number = 0;
  private static instance: MockUserSessionCacheRepository;

  constructor(_context: ApplicationContext) {
    this.cache = new Map<string, CamsSession>();
  }

  public static getInstance(_context: ApplicationContext) {
    if (!MockUserSessionCacheRepository.instance) {
      MockUserSessionCacheRepository.instance = new MockUserSessionCacheRepository(_context);
    }
    MockUserSessionCacheRepository.referenceCount++;
    return MockUserSessionCacheRepository.instance;
  }

  private static dropInstance() {
    if (MockUserSessionCacheRepository.referenceCount > 0) {
      MockUserSessionCacheRepository.referenceCount--;
    }
    if (MockUserSessionCacheRepository.referenceCount < 1) {
      MockUserSessionCacheRepository.instance = null;
    }
  }

  public release() {
    MockUserSessionCacheRepository.dropInstance();
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
