import { CamsSession } from '../../../../../common/src/cams/session';

export interface UserSessionCacheRepository {
  read: (token: string) => Promise<CamsSession>;
  upsert: (session: CamsSession) => Promise<CamsSession>;
}
