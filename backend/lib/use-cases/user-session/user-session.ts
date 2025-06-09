import { getAuthorizationGateway, getUserSessionCacheRepository } from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { isCamsError } from '../../common-errors/cams-error';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { CamsSession } from '../../../../common/src/cams/session';
import { isNotFoundError } from '../../common-errors/not-found-error';
import UsersHelpers from '../users/users.helpers';
import * as crypto from 'crypto';

const MODULE_NAME = 'USER-SESSION-GATEWAY';

export class UserSessionUseCase {
  async lookup(context: ApplicationContext, token: string, provider: string): Promise<CamsSession> {
    const sessionCacheRepository = getUserSessionCacheRepository(context);

    try {
      const session = await sessionCacheRepository.read(token);
      context.logger.debug(MODULE_NAME, 'Found session in cache.');
      return session;
    } catch (originalError) {
      if (isNotFoundError(originalError)) {
        // This is a cache miss. Continue.
        context.logger.debug(MODULE_NAME, 'Did not find session in cache.');
      } else {
        throw originalError;
      }
    }

    try {
      const authGateway = getAuthorizationGateway(context);
      if (!authGateway) {
        throw new ServerConfigError(MODULE_NAME, {
          message: 'Unsupported authentication provider.',
        });
      }

      context.logger.debug(MODULE_NAME, 'Getting user info from Okta.');
      const { user: camsUserReference, jwt } = await authGateway.getUser(token);
      const user = await UsersHelpers.getPrivilegedIdentityUser(context, camsUserReference.id);

      const session: CamsSession = {
        user,
        accessToken: token,
        provider: provider,
        expires: jwt.claims.exp,
        issuer: jwt.claims.iss,
      };

      context.logger.debug(MODULE_NAME, 'Putting session in cache.');
      await sessionCacheRepository.upsert(session);
      return session;
    } catch (error) {
      throw isCamsError(error)
        ? error
        : new UnauthorizedError(MODULE_NAME, {
            message: error.message,
            originalError: error,
          });
    }
  }

  async lookupApiKey(context: ApplicationContext, token: string): Promise<CamsSession> {
    // TODO: Convert the token to a hashed variant to use as the token to lookup in Cosmos.
    const hashedToken = crypto.createHash('sha256').update(token).digest('base64');

    const sessionCacheRepository = getUserSessionCacheRepository(context);

    try {
      const session = await sessionCacheRepository.read(hashedToken);
      context.logger.debug(MODULE_NAME, 'Found session in cache.');
      return session;
    } catch (originalError) {
      if (isNotFoundError(originalError)) {
        // This is a cache miss. Continue.
        context.logger.debug(MODULE_NAME, 'Did not find session in cache.');
      } else {
        throw originalError;
      }
    }

    try {
      if (token !== process.env.ADMIN_KEY) {
        throw new UnauthorizedError(MODULE_NAME, {
          message: 'Invalid API key in authorization header',
        });
      }

      // TODO: For now we will just return a static session since the current API key is also static.
      const session: CamsSession = {
        accessToken: hashedToken,
        expires: Date.now() + 3600 * 1000, // Now plus one hour.
        issuer: 'cams',
        provider: 'apikey',
        user: { id: 'apiuser', name: 'Api User' },
      };

      context.logger.debug(MODULE_NAME, 'Putting session in cache.');
      await sessionCacheRepository.upsert(session);
      return session;
    } catch (error) {
      throw isCamsError(error)
        ? error
        : new UnauthorizedError(MODULE_NAME, {
            message: error.message,
            originalError: error,
          });
    }
  }
}
