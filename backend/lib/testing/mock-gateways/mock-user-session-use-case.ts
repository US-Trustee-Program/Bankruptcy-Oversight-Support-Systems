import * as jwt from 'jsonwebtoken';

import { CamsJwtClaims } from '../../../../common/src/cams/jwt';
import { CamsSession } from '../../../../common/src/cams/session';
import { ApplicationContext } from '../../adapters/types/basic';
import { getUser } from './mock-oauth2-gateway';

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

    const { exp: expires, iss: issuer } = jwt.decode(accessToken) as CamsJwtClaims;
    const cacheEntry: CamsSession = { accessToken, expires, issuer, provider, user };
    cache.set(key, cacheEntry);

    return cacheEntry;
  }
}
