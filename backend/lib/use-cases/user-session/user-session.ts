import {
  getAuthorizationGateway,
  getUserSessionCacheRepository,
  getUsersRepository,
} from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import { isCamsError } from '../../common-errors/cams-error';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { UstpOfficeDetails } from '../../../../common/src/cams/offices';
import LocalStorageGateway from '../../adapters/gateways/storage/local-storage-gateway';
import { CamsRole } from '../../../../common/src/cams/roles';
import { CamsSession } from '../../../../common/src/cams/session';
import { REGION_02_GROUP_NY } from '../../../../common/src/cams/test-utilities/mock-user';
import { isNotFoundError } from '../../common-errors/not-found-error';
import { OfficesUseCase } from '../offices/offices';

const MODULE_NAME = 'USER-SESSION-GATEWAY';

function getRoles(groups: string[]): CamsRole[] {
  const rolesMap = LocalStorageGateway.getRoleMapping();
  return groups.filter((group) => rolesMap.has(group)).map((group) => rolesMap.get(group));
}

async function getOffices(
  _context: ApplicationContext,
  idpGroups: string[],
): Promise<UstpOfficeDetails[]> {
  const ustpOffices = LocalStorageGateway.getUstpOffices();
  return ustpOffices.filter((office) => idpGroups.includes(office.idpGroupId));
}

export class UserSessionUseCase {
  async lookup(context: ApplicationContext, token: string, provider: string): Promise<CamsSession> {
    const sessionCacheRepository = getUserSessionCacheRepository(context);
    const usersRepository = getUsersRepository(context);

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
      const { user, jwt } = await authGateway.getUser(token);
      user.roles = getRoles(jwt.claims.groups);
      user.offices = await getOffices(context, jwt.claims.groups);

      if (user.roles.includes(CamsRole.AugmentableUser)) {
        try {
          const augmentableUser = await usersRepository.getAugmentableUser(user.id);
          if (augmentableUser.roles) user.roles.push(...augmentableUser.roles);

          if (augmentableUser.officeCodes) {
            const officesUseCase = new OfficesUseCase();
            const offices = await officesUseCase.getOffices(context);
            const filteredOffices = offices.filter((office) =>
              augmentableUser.officeCodes.includes(office.officeCode),
            );

            const officeSet = new Set<UstpOfficeDetails>([...user.offices, ...filteredOffices]);
            user.offices = Array.from(officeSet);
          }
        } catch (error) {
          // Silently log the failure so the user can continue without augmentation.
          context.logger.error(
            MODULE_NAME,
            `Failed to augment user ${user.name} (${user.id}).`,
            error.message,
          );
        }
      }

      // TODO: Maybe delete this 'restrict-case-assignment' feature flag.
      // Simulate the legacy behavior by appending roles and Manhattan office to the user
      // if the 'restrict-case-assignment' feature flag is not set.
      if (!context.featureFlags['restrict-case-assignment']) {
        user.offices = [REGION_02_GROUP_NY];
        user.roles = [CamsRole.CaseAssignmentManager];
      }

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
}
