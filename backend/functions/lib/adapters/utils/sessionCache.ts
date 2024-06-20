import { CamsSession } from '../../../../../common/src/cams/session';

export interface SessionCache {
  lookup: (token: string) => Promise<CamsSession>;
}
