import { CamsUser, PrivilegedIdentityUser } from '../../../../common/src/cams/users';
import { getAuthorizationGateway } from '../../factory';
import { ApplicationContext } from '../../adapters/types/basic';

export type PrivilegedIdentityHelperOptions = {
  idpUser?: CamsUser;
  pimUser?: PrivilegedIdentityUser;
};

async function getPrivilegedIdentityUser(
  context: ApplicationContext,
  _userId: string,
  options?: PrivilegedIdentityHelperOptions,
) {
  if (!options) {
    const _authGateway = getAuthorizationGateway(context);
    // const user = await authGateway.getUser()
  }
}

const UsersHelpers = { getPrivilegedIdentityUser };

export default UsersHelpers;
