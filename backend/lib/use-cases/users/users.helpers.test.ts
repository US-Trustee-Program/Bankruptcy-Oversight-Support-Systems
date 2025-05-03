import { MOCKED_USTP_OFFICES_ARRAY } from '../../../../common/src/cams/offices';
import { CamsRole } from '../../../../common/src/cams/roles';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsUser, PrivilegedIdentityUser } from '../../../../common/src/cams/users';
import { ApplicationContext } from '../../adapters/types/basic';
import { NotFoundError } from '../../common-errors/not-found-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import MockUserGroupGateway from '../../testing/mock-gateways/mock-user-group-gateway';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import UsersHelpers from './users.helpers';

describe('UsersHelpers tests', () => {
  let context: ApplicationContext;
  const today = new Date().toISOString();
  const expiredDate = MockData.someDateBeforeThisDate(today);
  const unexpiredDate = MockData.someDateAfterThisDate(today);
  const manhattanOffice = MOCKED_USTP_OFFICES_ARRAY.find(
    (office) => office.idpGroupName === 'USTP CAMS Region 2 Office Manhattan',
  );
  const wilmingtonOffice = MOCKED_USTP_OFFICES_ARRAY.find(
    (office) => office.idpGroupName === 'USTP CAMS Region 3 Office Wilmington',
  );

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  test('should return idpUser when elevation is disabled', async () => {
    context.featureFlags['privileged-identity-management'] = false;
    const idpUser: CamsUser = MockData.getCamsUser({
      offices: [manhattanOffice],
      roles: [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser],
    });
    jest.spyOn(MockUserGroupGateway.prototype, 'getUserById').mockResolvedValue(idpUser);
    const pimSpy = jest
      .spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser')
      .mockRejectedValue(new Error('this should not be called'));

    const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id);
    expect(user).toEqual(idpUser);
    expect(pimSpy).not.toHaveBeenCalled();
  });

  test('should return idpUser when user does not have PrivilegedIdentityUser role', async () => {
    context.featureFlags['privileged-identity-management'] = true;
    const idpUser: CamsUser = MockData.getCamsUser({
      offices: [manhattanOffice],
      roles: [CamsRole.TrialAttorney],
    });
    jest.spyOn(MockUserGroupGateway.prototype, 'getUserById').mockResolvedValue(idpUser);
    const pimSpy = jest
      .spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser')
      .mockRejectedValue(new Error('this should not be called'));

    const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id);
    expect(user).toEqual(idpUser);
    expect(pimSpy).not.toHaveBeenCalled();
  });

  test('should return idpUser when user does not have PrivilegedIdentityUser record', async () => {
    context.featureFlags['privileged-identity-management'] = true;
    const idpUser: CamsUser = MockData.getCamsUser({
      offices: [manhattanOffice],
      roles: [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser],
    });
    jest.spyOn(MockUserGroupGateway.prototype, 'getUserById').mockResolvedValue(idpUser);
    const pimSpy = jest
      .spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser')
      .mockRejectedValue(new NotFoundError('test-module'));

    const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id);
    expect(user).toEqual(idpUser);
    expect(pimSpy).toHaveBeenCalled();
  });

  test('should return idpUser when UsersRepository encounters an error', async () => {
    context.featureFlags['privileged-identity-management'] = true;
    const idpUser: CamsUser = MockData.getCamsUser({
      offices: [manhattanOffice],
      roles: [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser],
    });
    jest.spyOn(MockUserGroupGateway.prototype, 'getUserById').mockResolvedValue(idpUser);
    const pimSpy = jest
      .spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser')
      .mockRejectedValue(new UnknownError('test-module'));

    const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id);
    expect(user).toEqual(idpUser);
    expect(pimSpy).toHaveBeenCalled();
  });

  test('should return idpUser when user has expired PrivilegedIdentityUser record', async () => {
    context.featureFlags['privileged-identity-management'] = true;
    const idpUser: CamsUser = MockData.getCamsUser({
      offices: [manhattanOffice],
      roles: [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser],
    });
    jest.spyOn(MockUserGroupGateway.prototype, 'getUserById').mockResolvedValue(idpUser);
    const elevation: PrivilegedIdentityUser = {
      claims: {
        groups: ['USTP CAMS Case Assignment Manager', 'USTP CAMS Region 3 Office Wilmington'],
      },
      documentType: 'PRIVILEGED_IDENTITY_USER',
      expires: expiredDate,
      id: idpUser.id,
      name: idpUser.name,
    };
    const pimSpy = jest
      .spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser')
      .mockResolvedValue(elevation);

    const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id);
    expect(user).toEqual(idpUser);
    expect(pimSpy).toHaveBeenCalled();
  });

  test('should return elevated privileges', async () => {
    const roles = [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser];
    const idpUser: CamsUser = MockData.getCamsUser({ offices: [manhattanOffice], roles });
    jest.spyOn(MockUserGroupGateway.prototype, 'getUserById').mockResolvedValue(idpUser);
    const elevation: PrivilegedIdentityUser = {
      claims: {
        groups: ['USTP CAMS Case Assignment Manager', wilmingtonOffice.idpGroupName],
      },
      documentType: 'PRIVILEGED_IDENTITY_USER',
      expires: unexpiredDate,
      id: idpUser.id,
      name: idpUser.name,
    };
    jest
      .spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser')
      .mockResolvedValue(elevation);

    const expected: CamsUser = {
      ...idpUser,
      offices: [manhattanOffice, wilmingtonOffice],
      roles: [...idpUser.roles, CamsRole.CaseAssignmentManager],
    };

    const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id);
    expect(user).toEqual(expected);
  });

  test('should return user when elevated privileges are not found', async () => {
    const roles = [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser];
    const idpUser: CamsUser = MockData.getCamsUser({ offices: [manhattanOffice], roles });
    jest.spyOn(MockUserGroupGateway.prototype, 'getUserById').mockResolvedValue(idpUser);
    jest
      .spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser')
      .mockRejectedValue(new NotFoundError('test-module'));

    const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id);
    expect(user).toEqual(idpUser);
  });

  test('should return combined privileges when providing the IDP user', async () => {
    const roles = [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser];
    const idpUser: CamsUser = MockData.getCamsUser({ offices: [manhattanOffice], roles });
    const idpSpy = jest
      .spyOn(MockUserGroupGateway.prototype, 'getUserById')
      .mockRejectedValue(new Error('this should not be called'));
    const elevation: PrivilegedIdentityUser = {
      claims: {
        groups: ['USTP CAMS Case Assignment Manager', wilmingtonOffice.idpGroupName],
      },
      documentType: 'PRIVILEGED_IDENTITY_USER',
      expires: MockData.someDateAfterThisDate(new Date().toISOString()),
      id: idpUser.id,
      name: idpUser.name,
    };
    const pimSpy = jest
      .spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser')
      .mockResolvedValue(elevation);

    const expected: CamsUser = {
      ...idpUser,
      offices: [manhattanOffice, wilmingtonOffice],
      roles: [...idpUser.roles, CamsRole.CaseAssignmentManager],
    };

    const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id, { idpUser });
    expect(user).toEqual(expected);
    expect(idpSpy).not.toHaveBeenCalled();
    expect(pimSpy).toHaveBeenCalled();
  });

  test('should return combined privileges when providing elevated privileges', async () => {
    const roles = [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser];
    const idpUser: CamsUser = MockData.getCamsUser({ offices: [manhattanOffice], roles });
    const idpSpy = jest
      .spyOn(MockUserGroupGateway.prototype, 'getUserById')
      .mockResolvedValue(idpUser);
    const pimUser: PrivilegedIdentityUser = {
      claims: {
        groups: ['USTP CAMS Case Assignment Manager', wilmingtonOffice.idpGroupName],
      },
      documentType: 'PRIVILEGED_IDENTITY_USER',
      expires: MockData.someDateAfterThisDate(new Date().toISOString()),
      id: idpUser.id,
      name: idpUser.name,
    };
    const pimSpy = jest
      .spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser')
      .mockRejectedValue(new Error('this should not be called'));

    const expected: CamsUser = {
      ...idpUser,
      offices: [manhattanOffice, wilmingtonOffice],
      roles: [...idpUser.roles, CamsRole.CaseAssignmentManager],
    };

    const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id, { pimUser });
    expect(idpSpy).toHaveBeenCalled();
    expect(pimSpy).not.toHaveBeenCalled();
    expect(user).toEqual(expected);
  });
});
