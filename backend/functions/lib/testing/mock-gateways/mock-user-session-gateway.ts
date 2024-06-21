import { CamsSession } from '../../../../../common/src/cams/session';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import { SessionCache } from '../../adapters/utils/sessionCache';

export class MockUserSessionGateway implements SessionCache {
  async lookup(
    _context: ApplicationContext,
    _token: string,
    _provider: string,
  ): Promise<CamsSession> {
    return MockData.getCamsSession();
  }
}
