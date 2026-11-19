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
import UsersGroupManagement from '../users/usersGroupManagement';
import { CamsUser, CamsUserReference } from '@common/cams/users';
import { CamsJwt } from '@common/cams/jwt';
import { delay } from '@common/delay';
import { UserSessionCacheRepository } from '../gateways.types';

const MODULE_NAME = 'USER-SESSION-GATEWAY';
const SIGN_IN_EVENT_NAME = 'CAMS Sign-In';

type GetUserResponse = { user: CamsUserReference; jwt: CamsJwt };

/**
 * Builds the "CAMS Sign-In" event properties. Slices 2-4 of CAMS-979 query these
 * property names, so do not rename them without updating those queries.
 * The person's name and id are deliberately excluded.
 */
function buildSignInEventProperties(user: CamsUser): Record<string, string> {
  const offices = [...user.offices].sort((a, b) => a.officeCode.localeCompare(b.officeCode));
  const regions = new Map(offices.map((office) => [office.regionId, office.regionName]));
  return {
    email: user.email ?? '',
    roles: JSON.stringify([...new Set(user.roles)].sort()),
    officeCodes: JSON.stringify(offices.map((office) => office.officeCode)),
    officeNames: JSON.stringify(offices.map((office) => office.officeName)),
    regionIds: JSON.stringify([...regions.keys()]),
    regionNames: JSON.stringify([...regions.values()]),
  };
}

function emitSignInEvent(context: ApplicationContext, user: CamsUser) {
  try {
    const trace = context.observability.startTrace(context.invocationId);
    context.observability.completeTrace(
      trace,
      SIGN_IN_EVENT_NAME,
      { success: true, properties: buildSignInEventProperties(user), measurements: {} },
      undefined,
      context.logger,
    );
  } catch (error) {
    context.logger.error(MODULE_NAME, 'Failed to emit sign-in telemetry event.', error);
  }
}

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
      const storedSession = await this.lookupSession(context, token);
      if (storedSession) {
        return storedSession;
      }

      const { user: camsUserReference, jwt: verifiedJwt } = await this.getUserFromIdentityProvider(
        context,
        token,
      );

      if (!verifiedJwt) {
        throw new UnauthorizedError('Missing JWT from identity provider');
      }

      const offices = await UsersGroupManagement.getOfficesFromGroupNames(
        context,
        verifiedJwt.claims.groups || [],
      );
      const roles = UsersGroupManagement.getRolesFromGroupNames(verifiedJwt.claims.groups || []);

      // Augment the user session with additional roles if applicable.
      const user = await UsersGroupManagement.getPrivilegedIdentityUser(
        context,
        camsUserReference.id,
        {
          idpUser: {
            id: camsUserReference.id,
            name: camsUserReference.name,
            email: camsUserReference.email,
            offices,
            roles,
          },
        },
      );

      context.logger.debug(
        MODULE_NAME,
        `Creating session for ${user.name} with ${verifiedJwt.claims.groups?.length || 0} JWT groups, ${user.offices?.length || 0} offices, ${user.roles?.length || 0} roles.`,
        {
          userId: user.id,
          jwtGroupCount: verifiedJwt.claims.groups?.length || 0,
          officeCount: user.offices?.length || 0,
          roleCount: user.roles?.length || 0,
        },
      );

      const newSession = {
        user,
        accessToken: token,
        provider: context.config.authConfig.provider,
        expires: verifiedJwt.claims.exp,
        issuer: verifiedJwt.claims.iss,
      };
      await this.writeSession(context, newSession);
      emitSignInEvent(context, user);
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
