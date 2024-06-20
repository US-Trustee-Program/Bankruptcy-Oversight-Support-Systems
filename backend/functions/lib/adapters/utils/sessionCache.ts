import { CamsSession } from '../../../../../common/src/cams/session';
import { ApplicationContext } from '../types/basic';

export interface SessionCache {
  lookup: (context: ApplicationContext, token: string, provider: string) => Promise<CamsSession>;
}
