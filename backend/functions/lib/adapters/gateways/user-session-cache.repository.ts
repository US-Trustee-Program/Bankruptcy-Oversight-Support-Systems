import { CamsSession } from '../../../../../common/src/cams/session';
import { ApplicationContext } from '../types/basic';

export interface UserSessionCacheRepository {
  get: (context: ApplicationContext, token: string) => Promise<CamsSession>;
  put: (context: ApplicationContext, session: CamsSession) => Promise<CamsSession>;
}
