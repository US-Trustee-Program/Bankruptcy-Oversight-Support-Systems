import * as jwt from 'jsonwebtoken';
import { ApplicationContext } from '../types/basic';
import { CamsSession } from '../../../../../common/src/cams/session';
import { UserSessionCacheRepository } from './user-session-cache.repository';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { CamsJwtClaims } from '../../../../../common/src/cams/jwt';
import { getCamsError } from '../../common-errors/error-utilities';
import { MongoCollectionAdapter } from './mongo/mongo-adapter';
import { DocumentClient } from '../../humble-objects/mongo-humble';
import QueryBuilder from '../../query/query-builder';
import { deferClose } from '../../defer-close';
import { CamsError } from '../../common-errors/cams-error';

const MODULE_NAME: string = 'USER_SESSION_CACHE_MONGO_REPOSITORY';
const COLLECTION_NAME: string = 'user-session-cache';

const { equals } = QueryBuilder;

export type CachedCamsSession = CamsSession & {
  id?: string;
  signature: string;
  ttl: number;
};

export class UserSessionCacheMongoRepository implements UserSessionCacheRepository {
  private readonly client: DocumentClient;
  private readonly databaseName: string;

  constructor(context: ApplicationContext) {
    const { connectionString, databaseName } = context.config.documentDbConfig;
    this.databaseName = databaseName;
    this.client = new DocumentClient(connectionString);
    deferClose(context, this.client);
  }

  private getAdapter<T>() {
    return MongoCollectionAdapter.newAdapter<T>(
      MODULE_NAME,
      COLLECTION_NAME,
      this.databaseName,
      this.client,
    );
  }

  public async read(token: string): Promise<CamsSession> {
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      throw new UnauthorizedError(MODULE_NAME, { message: 'Invalid token received.' });
    }
    const signature = tokenParts[2];
    const query = QueryBuilder.build(equals('signature', signature));

    try {
      const adapter = this.getAdapter<CachedCamsSession>();
      const cached = await adapter.find(query);
      if (cached.length !== 1) {
        throw new CamsError(MODULE_NAME, {
          message: 'Session not found or is ambiguous.',
        });
      }
      return toCamsSession(cached[0]);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async upsert(session: CamsSession): Promise<CamsSession> {
    const claims = jwt.decode(session.accessToken) as CamsJwtClaims;

    let signature;
    let ttl;
    try {
      const tokenParts = session.accessToken.split('.');
      ttl = Math.floor(claims.exp - Date.now() / 1000);
      signature = tokenParts[2];
    } catch (_err) {
      throw new UnauthorizedError(MODULE_NAME, { message: 'Invalid token received.' });
    }

    try {
      const query = QueryBuilder.build(equals('signature', signature));
      const cached: CachedCamsSession = {
        ...session,
        signature,
        ttl,
      };
      const adapter = this.getAdapter<CachedCamsSession>();
      await adapter.replaceOne(query, cached);
      return session;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }
}

function toCamsSession(cachedSession: CachedCamsSession): CamsSession {
  const { id: _, signature: _s, ttl: _t, ...camsSession } = cachedSession;
  return camsSession;
}
