import { vi } from 'vitest';
import UsersGroupManagement from './usersGroupManagement';
import { CamsUser, PrivilegedIdentityUser } from '@common/cams/users';
import MockData from '@common/cams/test-utilities/mock-data';
import { CamsRole } from '@common/cams/roles';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { MOCKED_USTP_OFFICES_ARRAY } from '@common/cams/test-utilities/offices.mock';
import { NotFoundError } from '../../common-errors/not-found-error';
import { UnknownError } from '../../common-errors/unknown-error';
import MockUserGroupGateway from '../../testing/mock-gateways/mock-user-group-gateway';

describe('UsersGroupManagement tests', () => {
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

    const user = await UsersGroupManagement.getPrivilegedIdentityUser(context, idpUser.id);
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

    const user = await UsersGroupManagement.getPrivilegedIdentityUser(context, idpUser.id);
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
    const errorSpy = vi.spyOn(context.logger, 'error');

    const user = await UsersGroupManagement.getPrivilegedIdentityUser(context, idpUser.id);
    expect(user).toEqual(idpUser);
    expect(pimSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(String),
      `Failed to elevate permissions for user ${idpUser.name} (${idpUser.id}).`,
      expect.any(String),
    );
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
    const errorSpy = vi.spyOn(context.logger, 'error');

    const user = await UsersGroupManagement.getPrivilegedIdentityUser(context, idpUser.id);
    expect(user).toEqual(idpUser);
    expect(pimSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(String),
      `Failed to elevate permissions for user ${idpUser.name} (${idpUser.id}).`,
      expect.any(String),
    );
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

    const user = await UsersGroupManagement.getPrivilegedIdentityUser(context, idpUser.id);
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

    const user = await UsersGroupManagement.getPrivilegedIdentityUser(context, idpUser.id);
    expect(user).toEqual(expected);
  });

  test('should return user when elevated privileges are not found', async () => {
    const roles = [CamsRole.TrialAttorney, CamsRole.PrivilegedIdentityUser];
    const idpUser: CamsUser = MockData.getCamsUser({ roles, offices: [manhattanOffice] });
    vi.spyOn(MockUserGroupGateway.prototype, 'getUserById').mockResolvedValue(idpUser);
    vi.spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser').mockRejectedValue(
      new NotFoundError('test-module'),
    );

    const user = await UsersGroupManagement.getPrivilegedIdentityUser(context, idpUser.id);
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

    const user = await UsersGroupManagement.getPrivilegedIdentityUser(context, idpUser.id, {
      idpUser,
    });
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

    const user = await UsersGroupManagement.getPrivilegedIdentityUser(context, idpUser.id, {
      pimUser,
    });
    expect(idpSpy).toHaveBeenCalled();
    expect(pimSpy).not.toHaveBeenCalled();
    expect(user).toEqual(expected);
  });

  test('should list an office once when the session and the elevation both grant it', async () => {
    context.featureFlags['privileged-identity-management'] = true;
    // A session built from permissions holds its own copy of the office object. Give it a
    // distinguishing field so the test can tell which copy the dedup keeps.
    const idpUser: CamsUser = {
      id: 'user-a',
      name: 'Alice Adams',
      roles: [CamsRole.TrialAttorney],
      offices: [{ ...manhattanOffice, officeName: 'Session Copy' }],
    };
    const pimUser: PrivilegedIdentityUser = {
      documentType: 'PRIVILEGED_IDENTITY_USER',
      id: idpUser.id,
      userId: idpUser.id,
      name: idpUser.name,
      claims: {
        groups: [
          manhattanOffice.idpGroupName,
          wilmingtonOffice.idpGroupName,
          'USTP CAMS Trial Attorney',
        ],
      },
      expires: unexpiredDate,
    } as PrivilegedIdentityUser;

    const user = await UsersGroupManagement.getPrivilegedIdentityUser(context, idpUser.id, {
      idpUser,
      pimUser,
    });

    expect(user.offices.map((office) => office.officeCode)).toEqual([
      manhattanOffice.officeCode,
      wilmingtonOffice.officeCode,
    ]);
    expect(user.roles).toEqual([CamsRole.TrialAttorney]);
    expect(
      user.offices.find((office) => office.officeCode === manhattanOffice.officeCode).officeName,
    ).toEqual('Session Copy');
  });
});

describe('getRolesFromGroupNames', () => {
  test('maps matching groups to roles, in group order, duplicates and all', () => {
    const roles = UsersGroupManagement.getRolesFromGroupNames([
      'USTP CAMS Trial Attorney',
      'USTP CAMS Trial Attorney',
      'USTP CAMS Auditor',
    ]);

    expect(roles).toEqual([CamsRole.TrialAttorney, CamsRole.TrialAttorney, CamsRole.Auditor]);
  });

  test('ignores groups with no role mapping', () => {
    const roles = UsersGroupManagement.getRolesFromGroupNames(['not-a-role-group']);

    expect(roles).toEqual([]);
  });
});

describe('getOfficesFromGroupNames', () => {
  let context: ApplicationContext;
  const manhattanOffice = MOCKED_USTP_OFFICES_ARRAY.find(
    (office) => office.idpGroupName === 'USTP CAMS Region 2 Office Manhattan',
  );
  const wilmingtonOffice = MOCKED_USTP_OFFICES_ARRAY.find(
    (office) => office.idpGroupName === 'USTP CAMS Region 3 Office Wilmington',
  );

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  test('matches offices by idpGroupName, in office-list order, ignoring groups that match no office', async () => {
    const offices = await UsersGroupManagement.getOfficesFromGroupNames(context, [
      manhattanOffice.idpGroupName,
      wilmingtonOffice.idpGroupName,
      'not-an-office-group',
    ]);

    // The function filters the office list rather than mapping the input groups, so the result
    // follows the office list's order (Wilmington before Manhattan), not the groups' order.
    expect(offices.map((office) => office.officeCode)).toEqual([
      wilmingtonOffice.officeCode,
      manhattanOffice.officeCode,
    ]);
  });

  test('matches an office once even when its group is repeated in the input', async () => {
    const offices = await UsersGroupManagement.getOfficesFromGroupNames(context, [
      manhattanOffice.idpGroupName,
      manhattanOffice.idpGroupName,
    ]);

    expect(offices.map((office) => office.officeCode)).toEqual([manhattanOffice.officeCode]);
  });

  test('returns no offices when no group matches', async () => {
    const offices = await UsersGroupManagement.getOfficesFromGroupNames(context, [
      'not-an-office-group',
    ]);

    expect(offices).toEqual([]);
  });
});
