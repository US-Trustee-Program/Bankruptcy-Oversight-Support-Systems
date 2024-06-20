import { ApplicationContext } from '../types/basic';
import { CosmosDbRepository } from './cosmos/cosmos.repository';
import { CamsSession } from '../../../../../common/src/cams/session';
import { UserSessionCacheRepository } from './user-session-cache.repository';

const MODULE_NAME: string = 'COSMOS_DB_REPOSITORY_CONSOLIDATION_ORDERS';
const CONTAINER_NAME: string = 'consolidations';

type CachedCamsSession = CamsSession & {
  id: string;
};

export class UserSessionCacheCosmosDbRepository implements UserSessionCacheRepository {
  private repo: CosmosDbRepository<CachedCamsSession>;
  constructor(context: ApplicationContext) {
    this.repo = new CosmosDbRepository<CachedCamsSession>(context, CONTAINER_NAME, MODULE_NAME);
  }

  public async get(context: ApplicationContext, token: string) {
    const signature = token.split('.')[2];
    const cached = await this.repo.get(context, signature, signature);
    if (cached) {
      const { id: _, ...camsSession } = cached;
      return camsSession as CamsSession;
    } else {
      return null;
    }
  }

  public async put(context: ApplicationContext, session: CamsSession) {
    const signature = session.apiToken.split('.')[2];
    const cached: CachedCamsSession = {
      ...session,
      id: signature,
    };
    const { id: _, ...camsSession } = await this.repo.put(context, cached);
    return camsSession;
  }
}
