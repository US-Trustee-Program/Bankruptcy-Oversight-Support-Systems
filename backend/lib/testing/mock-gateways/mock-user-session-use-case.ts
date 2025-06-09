import * as jwt from 'jsonwebtoken';
import { ApplicationContext } from '../../adapters/types/basic';
import { getUser } from './mock-oauth2-gateway';
import { CamsSession } from '../../../../common/src/cams/session';
import { CamsJwtClaims } from '../../../../common/src/cams/jwt';
import * as crypto from 'crypto';

const cache = new Map<string, CamsSession>();

export class MockUserSessionUseCase {
  async lookup(
    _context: ApplicationContext,
    accessToken: string,
    provider: string,
  ): Promise<CamsSession> {
    // TODO: MAYBE we overlay the PIM record using the user helper function.
    const { user } = await getUser(accessToken);

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

  async lookupApiKey(_context: ApplicationContext, token: string): Promise<CamsSession> {
    const hashedToken = crypto.createHash('sha256').update(token).digest('base64');

    if (cache.has(hashedToken)) {
      return cache.get(hashedToken);
    }

    const cacheEntry: CamsSession = {
      accessToken: hashedToken,
      expires: Date.now() + 3600 * 1000, // Now plus one hour.
      issuer: 'cams',
      provider: 'apikey',
      user: { id: 'apiuser', name: 'Api User' },
    };

    cache.set(hashedToken, cacheEntry);
    return cacheEntry;
  }
}
