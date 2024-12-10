import * as jwt from 'jsonwebtoken';
import { ApplicationContext } from '../../adapters/types/basic';
import { getUser } from './mock-oauth2-gateway';
import { CamsSession } from '../../../../common/src/cams/session';
import { CamsRole } from '../../../../common/src/cams/roles';
import { CamsJwtClaims } from '../../../../common/src/cams/jwt';
import { REGION_02_GROUP_NY } from '../../../../common/src/cams/test-utilities/mock-user';

const cache = new Map<string, CamsSession>();

export class MockUserSessionUseCase {
  async lookup(
    context: ApplicationContext,
    accessToken: string,
    provider: string,
  ): Promise<CamsSession> {
    const { user } = await getUser(accessToken);

    const parts = accessToken.split('.');
    const key = parts[2];

    if (cache.has(key)) {
      return cache.get(key);
    }

    // Simulate the legacy behavior by appending roles and Manhattan office to the user
    // if the 'restrict-case-assignment' feature flag is not set.
    if (!context.featureFlags['restrict-case-assignment']) {
      user.offices = [REGION_02_GROUP_NY];
      user.roles = [CamsRole.CaseAssignmentManager];
    }

    const { iss: issuer, exp: expires } = jwt.decode(accessToken) as CamsJwtClaims;
    const cacheEntry: CamsSession = { user, provider, accessToken, expires, issuer };
    cache.set(key, cacheEntry);

    return cacheEntry;
  }
}
