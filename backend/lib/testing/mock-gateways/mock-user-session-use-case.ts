import * as jwt from 'jsonwebtoken';
import { ApplicationContext } from '../../adapters/types/basic';
import { getUser } from './mock-oauth2-gateway';
import { CamsSession } from '@common/cams/session';
import { CamsJwtClaims } from '@common/cams/jwt';

const cache = new Map<string, CamsSession>();

export class MockUserSessionUseCase {
  async lookup(context: ApplicationContext, accessToken: string): Promise<CamsSession> {
    // TODO: MAYBE we overlay the PIM record using the user helper function.
    const { provider } = context.config.authConfig;
    const { user } = await getUser(context, accessToken);

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
