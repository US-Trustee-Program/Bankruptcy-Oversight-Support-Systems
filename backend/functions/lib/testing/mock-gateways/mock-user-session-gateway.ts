import * as jwt from 'jsonwebtoken';
import { CamsSession } from '../../../../../common/src/cams/session';
import { ApplicationContext } from '../../adapters/types/basic';
import { SessionCache } from '../../adapters/utils/sessionCache';
import { getUser } from './mock-oauth2-gateway';
import { CamsJwtClaims } from '../../adapters/types/authorization';

const cache = new Map<string, CamsSession>();

export class MockUserSessionGateway implements SessionCache {
  async lookup(
    _context: ApplicationContext,
    accessToken: string,
    provider: string,
  ): Promise<CamsSession> {
    const user = await getUser(accessToken);

    const parts = accessToken.split('.');
    const key = parts[2];

    if (cache.has(key)) {
      return cache.get(key);
    }

    const { iss: issuer, exp: expires } = jwt.decode(accessToken) as CamsJwtClaims;
    const cacheEntry: CamsSession = { user, provider, accessToken, expires, issuer };
    cache.set(key, cacheEntry);

    return cacheEntry;
  }
}
