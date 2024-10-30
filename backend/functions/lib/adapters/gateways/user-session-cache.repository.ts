import { CamsSession } from '../../../../../common/src/cams/session';

// TODO: MOve this into gateway.types.ts
export interface UserSessionCacheRepository {
  read: (token: string) => Promise<CamsSession>;
  upsert: (session: CamsSession) => Promise<CamsSession>;
}
