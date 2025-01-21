import UsersHelpers from './users.helpers';
import { CamsUser, PrivilegedIdentityUser } from '../../../../common/src/cams/users';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsRole } from '../../../../common/src/cams/roles';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockUserGroupGateway } from '../../testing/mock-gateways/mock.user-group.gateway';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { MOCKED_USTP_OFFICES_ARRAY, UstpOfficeDetails } from '../../../../common/src/cams/offices';
import { NotFoundError } from '../../common-errors/not-found-error';

describe('UsersHelpers tests', () => {
  let context: ApplicationContext;
  const manhattanOffice = MOCKED_USTP_OFFICES_ARRAY.find(
    (office) => office.idpGroupId === 'USTP CAMS Region 2 Office Manhattan',
  );
  const wilmingtonOffice = MOCKED_USTP_OFFICES_ARRAY.find(
    (office) => office.idpGroupId === 'USTP CAMS Region 3 Office Wilmington',
  );

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  const idpOnlyCases = [
    ['user does not have PrivilegedIdentityUser role', [CamsRole.TrialAttorney], [manhattanOffice]],
    [
      'user does not have PrivilegedIdentityUser record',
      [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser],
      [manhattanOffice],
    ],
    [
      'user has expired PrivilegedIdentityUser record',
      [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser],
      [manhattanOffice],
    ],
    [
      'UsersRepository encounters an error',
      [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser],
      [manhattanOffice],
    ],
  ];
  test.each(idpOnlyCases)(
    'should return only roles and offices from identity provider if %s',
    async (_caseName: string, roles: CamsRole[], offices: UstpOfficeDetails[]) => {
      const idpUser: CamsUser = MockData.getCamsUser({ roles, offices });
      jest.spyOn(MockUserGroupGateway.prototype, 'getUserById').mockResolvedValue(idpUser);
      const expired: PrivilegedIdentityUser = {
        documentType: 'PRIVILEGED_IDENTITY_USER',
        id: idpUser.id,
        name: idpUser.name,
        claims: {
          groups: ['USTP CAMS Case Assignment Manager', 'USTP CAMS Region 3 Office Wilmington'],
        },
        expires: MockData.someDateBeforeThisDate(new Date().toISOString()),
      };
      jest
        .spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser')
        .mockResolvedValue(expired);

      const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id);
      expect(user).toEqual(idpUser);
    },
  );

  test('should return elevated privileges', async () => {
    const roles = [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser];
    const idpUser: CamsUser = MockData.getCamsUser({ roles, offices: [manhattanOffice] });
    jest.spyOn(MockUserGroupGateway.prototype, 'getUserById').mockResolvedValue(idpUser);
    const elevation: PrivilegedIdentityUser = {
      documentType: 'PRIVILEGED_IDENTITY_USER',
      id: idpUser.id,
      name: idpUser.name,
      claims: {
        groups: ['USTP CAMS Case Assignment Manager', wilmingtonOffice.idpGroupId],
      },
      expires: MockData.someDateAfterThisDate(new Date().toISOString()),
    };
    jest
      .spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser')
      .mockResolvedValue(elevation);

    const expected: CamsUser = {
      ...idpUser,
      roles: [...idpUser.roles, CamsRole.CaseAssignmentManager],
      offices: [manhattanOffice, wilmingtonOffice],
    };

    const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id);
    expect(user).toEqual(expected);
  });

  test('should return user when elevated privileges are not found', async () => {
    const roles = [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser];
    const idpUser: CamsUser = MockData.getCamsUser({ roles, offices: [manhattanOffice] });
    jest.spyOn(MockUserGroupGateway.prototype, 'getUserById').mockResolvedValue(idpUser);
    jest
      .spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser')
      .mockRejectedValue(new NotFoundError('test-module'));

    const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id);
    expect(user).toEqual(idpUser);
  });

  test('should return combined privileges when providing the IDP user', async () => {
    const roles = [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser];
    const idpUser: CamsUser = MockData.getCamsUser({ roles, offices: [manhattanOffice] });
    const idpSpy = jest
      .spyOn(MockUserGroupGateway.prototype, 'getUserById')
      .mockRejectedValue(new Error('this should not be called'));
    const elevation: PrivilegedIdentityUser = {
      documentType: 'PRIVILEGED_IDENTITY_USER',
      id: idpUser.id,
      name: idpUser.name,
      claims: {
        groups: ['USTP CAMS Case Assignment Manager', wilmingtonOffice.idpGroupId],
      },
      expires: MockData.someDateAfterThisDate(new Date().toISOString()),
    };
    const pimSpy = jest
      .spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser')
      .mockResolvedValue(elevation);

    const expected: CamsUser = {
      ...idpUser,
      roles: [...idpUser.roles, CamsRole.CaseAssignmentManager],
      offices: [manhattanOffice, wilmingtonOffice],
    };

    const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id, { idpUser });
    expect(user).toEqual(expected);
    expect(idpSpy).not.toHaveBeenCalled();
    expect(pimSpy).toHaveBeenCalled();
  });

  test('should return combined privileges when providing elevated privileges', async () => {
    const roles = [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser];
    const idpUser: CamsUser = MockData.getCamsUser({ roles, offices: [manhattanOffice] });
    const idpSpy = jest
      .spyOn(MockUserGroupGateway.prototype, 'getUserById')
      .mockResolvedValue(idpUser);
    const pimUser: PrivilegedIdentityUser = {
      documentType: 'PRIVILEGED_IDENTITY_USER',
      id: idpUser.id,
      name: idpUser.name,
      claims: {
        groups: ['USTP CAMS Case Assignment Manager', wilmingtonOffice.idpGroupId],
      },
      expires: MockData.someDateAfterThisDate(new Date().toISOString()),
    };
    const pimSpy = jest
      .spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser')
      .mockRejectedValue(new Error('this should not be called'));

    const expected: CamsUser = {
      ...idpUser,
      roles: [...idpUser.roles, CamsRole.CaseAssignmentManager],
      offices: [manhattanOffice, wilmingtonOffice],
    };

    const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id, { pimUser });
    expect(user).toEqual(expected);
    expect(idpSpy).toHaveBeenCalled();
    expect(pimSpy).not.toHaveBeenCalled();
  });
});
