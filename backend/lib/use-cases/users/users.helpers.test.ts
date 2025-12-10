import { vi } from 'vitest';
import UsersHelpers from './users.helpers';
import { CamsUser, PrivilegedIdentityUser } from '../../../../common/src/cams/users';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsRole } from '../../../../common/src/cams/roles';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { MOCKED_USTP_OFFICES_ARRAY } from '../../../../common/src/cams/offices';
import { NotFoundError } from '../../common-errors/not-found-error';
import { UnknownError } from '../../common-errors/unknown-error';
import MockUserGroupGateway from '../../testing/mock-gateways/mock-user-group-gateway';

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
      roles: [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser],
      offices: [manhattanOffice],
    });
    vi.spyOn(MockUserGroupGateway.prototype, 'getUserById').mockResolvedValue(idpUser);
    const pimSpy = vi
      .spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser')
      .mockRejectedValue(new Error('this should not be called'));

    const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id);
    expect(user).toEqual(idpUser);
    expect(pimSpy).not.toHaveBeenCalled();
  });

  test('should return idpUser when user does not have PrivilegedIdentityUser role', async () => {
    context.featureFlags['privileged-identity-management'] = true;
    const idpUser: CamsUser = MockData.getCamsUser({
      roles: [CamsRole.TrialAttorney],
      offices: [manhattanOffice],
    });
    vi.spyOn(MockUserGroupGateway.prototype, 'getUserById').mockResolvedValue(idpUser);
    const pimSpy = vi
      .spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser')
      .mockRejectedValue(new Error('this should not be called'));

    const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id);
    expect(user).toEqual(idpUser);
    expect(pimSpy).not.toHaveBeenCalled();
  });

  test('should return idpUser when user does not have PrivilegedIdentityUser record', async () => {
    context.featureFlags['privileged-identity-management'] = true;
    const idpUser: CamsUser = MockData.getCamsUser({
      roles: [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser],
      offices: [manhattanOffice],
    });
    vi.spyOn(MockUserGroupGateway.prototype, 'getUserById').mockResolvedValue(idpUser);
    const pimSpy = vi
      .spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser')
      .mockRejectedValue(new NotFoundError('test-module'));

    const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id);
    expect(user).toEqual(idpUser);
    expect(pimSpy).toHaveBeenCalled();
  });

  test('should return idpUser when UsersRepository encounters an error', async () => {
    context.featureFlags['privileged-identity-management'] = true;
    const idpUser: CamsUser = MockData.getCamsUser({
      roles: [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser],
      offices: [manhattanOffice],
    });
    vi.spyOn(MockUserGroupGateway.prototype, 'getUserById').mockResolvedValue(idpUser);
    const pimSpy = vi
      .spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser')
      .mockRejectedValue(new UnknownError('test-module'));

    const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id);
    expect(user).toEqual(idpUser);
    expect(pimSpy).toHaveBeenCalled();
  });

  test('should return idpUser when user has expired PrivilegedIdentityUser record', async () => {
    context.featureFlags['privileged-identity-management'] = true;
    const idpUser: CamsUser = MockData.getCamsUser({
      roles: [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser],
      offices: [manhattanOffice],
    });
    vi.spyOn(MockUserGroupGateway.prototype, 'getUserById').mockResolvedValue(idpUser);
    const elevation: PrivilegedIdentityUser = {
      documentType: 'PRIVILEGED_IDENTITY_USER',
      id: idpUser.id,
      name: idpUser.name,
      claims: {
        groups: ['USTP CAMS Case Assignment Manager', 'USTP CAMS Region 3 Office Wilmington'],
      },
      expires: expiredDate,
    };
    const pimSpy = vi
      .spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser')
      .mockResolvedValue(elevation);

    const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id);
    expect(user).toEqual(idpUser);
    expect(pimSpy).toHaveBeenCalled();
  });

  test('should return elevated privileges', async () => {
    const roles = [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser];
    const idpUser: CamsUser = MockData.getCamsUser({ roles, offices: [manhattanOffice] });
    vi.spyOn(MockUserGroupGateway.prototype, 'getUserById').mockResolvedValue(idpUser);
    const elevation: PrivilegedIdentityUser = {
      documentType: 'PRIVILEGED_IDENTITY_USER',
      id: idpUser.id,
      name: idpUser.name,
      claims: {
        groups: ['USTP CAMS Case Assignment Manager', wilmingtonOffice.idpGroupName],
      },
      expires: unexpiredDate,
    };
    vi.spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser').mockResolvedValue(
      elevation,
    );

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
    vi.spyOn(MockUserGroupGateway.prototype, 'getUserById').mockResolvedValue(idpUser);
    vi.spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser').mockRejectedValue(
      new NotFoundError('test-module'),
    );

    const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id);
    expect(user).toEqual(idpUser);
  });

  test('should return combined privileges when providing the IDP user', async () => {
    const roles = [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser];
    const idpUser: CamsUser = MockData.getCamsUser({ roles, offices: [manhattanOffice] });
    const idpSpy = vi
      .spyOn(MockUserGroupGateway.prototype, 'getUserById')
      .mockRejectedValue(new Error('this should not be called'));
    const elevation: PrivilegedIdentityUser = {
      documentType: 'PRIVILEGED_IDENTITY_USER',
      id: idpUser.id,
      name: idpUser.name,
      claims: {
        groups: ['USTP CAMS Case Assignment Manager', wilmingtonOffice.idpGroupName],
      },
      expires: MockData.someDateAfterThisDate(new Date().toISOString()),
    };
    const pimSpy = vi
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
    const idpSpy = vi
      .spyOn(MockUserGroupGateway.prototype, 'getUserById')
      .mockResolvedValue(idpUser);
    const pimUser: PrivilegedIdentityUser = {
      documentType: 'PRIVILEGED_IDENTITY_USER',
      id: idpUser.id,
      name: idpUser.name,
      claims: {
        groups: ['USTP CAMS Case Assignment Manager', wilmingtonOffice.idpGroupName],
      },
      expires: MockData.someDateAfterThisDate(new Date().toISOString()),
    };
    const pimSpy = vi
      .spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser')
      .mockRejectedValue(new Error('this should not be called'));

    const expected: CamsUser = {
      ...idpUser,
      roles: [...idpUser.roles, CamsRole.CaseAssignmentManager],
      offices: [manhattanOffice, wilmingtonOffice],
    };

    const user = await UsersHelpers.getPrivilegedIdentityUser(context, idpUser.id, { pimUser });
    expect(idpSpy).toHaveBeenCalled();
    expect(pimSpy).not.toHaveBeenCalled();
    expect(user).toEqual(expected);
  });
});
