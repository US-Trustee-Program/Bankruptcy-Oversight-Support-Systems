import UsersHelpers from './users.helpers';
import { CamsUser } from '../../../../common/src/cams/users';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsRole } from '../../../../common/src/cams/roles';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';

describe.skip('UsersHelpers tests', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  describe('getPrivilegedIdentityUser tests', () => {
    const idpOnlyCases = [
      ['user does not have PrivilegedIdentityUser role', [CamsRole.TrialAttorney]],
      [
        'user does not have PrivilegedIdentityUser record',
        [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser],
      ],
      [
        'user has expired PrivilegedIdentityUser record',
        [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser],
      ],
      [
        'UsersRepository encounters an error',
        [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser],
      ],
    ];
    test.each(idpOnlyCases)(
      'should return only roles and offices from identity provider if %s',
      async (_caseName: string, roles: CamsRole[]) => {
        const idpUser: CamsUser = MockData.getCamsUser({ roles });
        const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id);
        expect(user).toBeDefined();
      },
    );
  });
});
