import { CamsSession } from '../../../../../common/src/cams/session';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import { SessionCache } from '../../adapters/utils/sessionCache';
import { getUser } from './mock-oauth2-gateway';

export class MockUserSessionGateway implements SessionCache {
  async lookup(
    _context: ApplicationContext,
    token: string,
    provider: string,
  ): Promise<CamsSession> {
    const user = await getUser(token);
    return MockData.getCamsSession({ user, provider, accessToken: token });
  }
}
