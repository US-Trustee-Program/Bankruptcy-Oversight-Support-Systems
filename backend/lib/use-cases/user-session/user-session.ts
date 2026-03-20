import factory from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { isCamsError } from '../../common-errors/cams-error';
import {
  ServerConfigError,
  UNSUPPORTED_AUTHENTICATION_PROVIDER,
} from '../../common-errors/server-config-error';
import { CamsSession } from '@common/cams/session';
import { isNotFoundError } from '../../common-errors/not-found-error';
import UsersHelpers from '../users/users.helpers';
import { CamsUserReference } from '@common/cams/users';
import { CamsJwt } from '@common/cams/jwt';
import { delay } from '@common/delay';
import { UserSessionCacheRepository } from '../gateways.types';

const MODULE_NAME = 'USER-SESSION-GATEWAY';

type GetUserResponse = { user: CamsUserReference; jwt: CamsJwt };

export class UserSessionUseCase {
  private readonly sessionCacheRepository: UserSessionCacheRepository;

  constructor(context: ApplicationContext) {
    this.sessionCacheRepository = factory.getUserSessionCacheRepository(context);
  }

  private async lookupSession(context: ApplicationContext, token: string) {
    try {
      const session = await this.sessionCacheRepository.read(token);
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
  }

  private async getUserFromIdentityProvider(
    context: ApplicationContext,
    token: string,
  ): Promise<GetUserResponse> {
    const authGateway = factory.getAuthorizationGateway(context);
    if (!authGateway) {
      throw new ServerConfigError(MODULE_NAME, {
        message: UNSUPPORTED_AUTHENTICATION_PROVIDER,
      });
    }
    const MAX_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await authGateway.getUser(context, token);
      } catch (error) {
        if (attempt >= MAX_RETRIES) {
          throw error;
        }
        context.logger.error(
          MODULE_NAME,
          `Identity provider call failed (attempt ${attempt}/${MAX_RETRIES})`,
          error,
        );
        await delay(2 ** attempt * 1000);
      }
    }
  }

  private async writeSession(context: ApplicationContext, session: CamsSession) {
    context.logger.debug(MODULE_NAME, 'Putting session in cache.');
    await this.sessionCacheRepository.upsert(session);
  }

  async lookup(context: ApplicationContext, token: string): Promise<CamsSession> {
    try {
      // Check for a cached session to return.
      const storedSession = await this.lookupSession(context, token);
      if (storedSession) {
        return storedSession;
      }

      // Otherwise get the user information from the identity provider.
      const { user: camsUserReference, jwt } = await this.getUserFromIdentityProvider(
        context,
        token,
      );

      // Check for missing JWT and throw UnauthorizedError if not present.
      if (!jwt) {
        throw new UnauthorizedError('Missing JWT from identity provider');
      }

      context.logger.info(
        MODULE_NAME,
        `CAMS-710 DIAGNOSTIC: Retrieved user from IDP: ${camsUserReference.name} (${camsUserReference.id}). JWT contains ${jwt.claims.groups?.length || 0} groups.`,
        {
          userId: camsUserReference.id,
          userName: camsUserReference.name,
          userEmail: camsUserReference.email,
          jwtGroupCount: jwt.claims.groups?.length || 0,
          jwtGroups: jwt.claims.groups || [],
        },
      );

      // Use verified JWT groups to build user offices and roles
      // (avoids redundant Okta API call that may have different permissions)
      const offices = await UsersHelpers.getOfficesFromGroupNames(context, jwt.claims.groups || []);
      const roles = UsersHelpers.getRolesFromGroupNames(jwt.claims.groups || []);

      // Augment the user session with additional roles if applicable.
      const user = await UsersHelpers.getPrivilegedIdentityUser(context, camsUserReference.id, {
        idpUser: {
          id: camsUserReference.id,
          name: camsUserReference.name,
          email: camsUserReference.email,
          offices,
          roles,
        },
      });

      context.logger.info(
        MODULE_NAME,
        `CAMS-710 DIAGNOSTIC: Creating session for user ${user.name} (${user.id}) with ${user.offices?.length || 0} offices and ${user.roles?.length || 0} roles.`,
        {
          userId: user.id,
          userName: user.name,
          officeCount: user.offices?.length || 0,
          roleCount: user.roles?.length || 0,
          offices: user.offices?.map((o) => o.idpGroupName) || [],
        },
      );

      // Cache and return a new session.
      const newSession = {
        user,
        accessToken: token,
        provider: context.config.authConfig.provider,
        expires: jwt.claims.exp,
        issuer: jwt.claims.iss,
      };
      await this.writeSession(context, newSession);
      return newSession;
    } catch (originalError) {
      throw isCamsError(originalError)
        ? originalError
        : new UnauthorizedError(MODULE_NAME, {
            message: originalError.message,
            originalError,
          });
    }
  }
}
