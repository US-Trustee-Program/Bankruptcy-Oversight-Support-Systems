import { createMockApplicationContext } from '../../testing/testing-utilities';
import { AdminUseCase } from './admin';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { ApplicationContext } from '../../adapters/types/basic';
import { PrivilegedIdentityUser } from '../../../../common/src/cams/users';
import { randomUUID } from 'node:crypto';
import { getCamsUserReference } from '../../../../common/src/cams/session';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { NotFoundError } from '../../common-errors/not-found-error';
import { UnknownError } from '../../common-errors/unknown-error';
import { MOCKED_USTP_OFFICES_ARRAY } from '../../../../common/src/cams/offices';
import LocalStorageGateway from '../../adapters/gateways/storage/local-storage-gateway';
import { MockOfficesGateway } from '../../testing/mock-gateways/mock.offices.gateway';
import { BadRequestError } from '../../common-errors/bad-request';
import DateHelper from '../../../../common/src/date-helper';
import { SYSTEM_USER_REFERENCE } from '../../../../common/src/cams/auditable';
import MockUserGroupGateway from '../../testing/mock-gateways/mock-user-group-gateway';

describe('Admin Use Case', () => {
  let context: ApplicationContext;
  let useCase: AdminUseCase;
  const currentDay = DateHelper.getTodaysIsoDate();
  const futureDate = MockData.someDateAfterThisDate(currentDay, 2);
  const pastDate = MockData.someDateBeforeThisDate(currentDay, 2);

  beforeEach(async () => {
    context = await createMockApplicationContext();
    useCase = new AdminUseCase();
  });

  test('should add roles and offices to PrivilegedIdentityUser with an expiration in the future', async () => {
    const users = MockData.buildArray(MockData.getCamsUser, 4);
    jest.spyOn(MockUserGroupGateway.prototype, 'getUserGroupWithUsers').mockResolvedValue({
      id: randomUUID(),
      name: 'Test User Group',
      users,
    });
    const repoSpy = jest
      .spyOn(MockMongoRepository.prototype, 'putPrivilegedIdentityUser')
      .mockResolvedValue({ id: users[0].id, modifiedCount: 0, upsertedCount: 1 });
    const officeSpy = jest
      .spyOn(MockMongoRepository.prototype, 'putOrExtendOfficeStaff')
      .mockResolvedValue();

    const groups = ['USTP CAMS Case Assignment Manager', 'USTP CAMS Region 2 Office Manhattan'];

    const expected: PrivilegedIdentityUser = {
      id: users[0].id,
      name: users[0].name,
      documentType: 'PRIVILEGED_IDENTITY_USER',
      claims: { groups },
      expires: futureDate,
    };

    await useCase.elevatePrivilegedUser(context, users[0].id, SYSTEM_USER_REFERENCE, {
      groups,
      expires: futureDate,
    });

    expect(repoSpy).toHaveBeenCalledWith(expected, SYSTEM_USER_REFERENCE);
    expect(officeSpy).toHaveBeenCalled();
  });

  const privilegedIdentityUserFailureCases = [
    ['no expiration', undefined],
    ['today expiration', currentDay],
    ['past expiration', pastDate],
  ];
  test.each(privilegedIdentityUserFailureCases)(
    'should throw bad request with %s',
    async (_caseName: string, expires: string) => {
      const users = MockData.buildArray(MockData.getCamsUser, 4);
      const user = users[0];

      jest.spyOn(MockUserGroupGateway.prototype, 'getUserGroupWithUsers').mockResolvedValue({
        id: randomUUID(),
        name: 'Test User Group',
        users,
      });
      const repoSpy = jest.spyOn(MockMongoRepository.prototype, 'putPrivilegedIdentityUser');
      const officeSpy = jest.spyOn(MockMongoRepository.prototype, 'putOrExtendOfficeStaff');

      const groups = ['USTP CAMS Case Assignment Manager', 'USTP CAMS Region 2 Office Manhattan'];

      await expect(
        useCase.elevatePrivilegedUser(context, user.id, SYSTEM_USER_REFERENCE, {
          groups,
          expires,
        }),
      ).rejects.toThrow(new BadRequestError(expect.anything()));
      expect(repoSpy).not.toHaveBeenCalled();
      expect(officeSpy).not.toHaveBeenCalled();
    },
  );

  test('should throw an error if elevatePrivilegedUser fails to upsert the user', async () => {
    const user = MockData.getCamsUser();
    jest.spyOn(MockUserGroupGateway.prototype, 'getUserGroupWithUsers').mockResolvedValue({
      id: 'groupId',
      name: 'Test User Group',
      users: [user],
    });

    jest
      .spyOn(MockMongoRepository.prototype, 'putPrivilegedIdentityUser')
      .mockResolvedValue({ id: null, modifiedCount: 0, upsertedCount: 0 });

    await expect(
      useCase.elevatePrivilegedUser(context, user.id, SYSTEM_USER_REFERENCE, {
        groups: [],
        expires: MockData.someDateAfterThisDate(new Date().toISOString()),
      }),
    ).rejects.toThrow('Failed to add privileged identity user.');
  });

  test('should throw an error if the user is not an privileged identity user', async () => {
    const userId = 'non-privileged identity-user';
    jest.spyOn(MockUserGroupGateway.prototype, 'getUserGroupWithUsers').mockResolvedValue({
      id: 'groupId',
      name: 'Test User Group',
      users: [MockData.getCamsUser()],
    });

    await expect(
      useCase.elevatePrivilegedUser(context, userId, SYSTEM_USER_REFERENCE, {
        groups: [],
        expires: MockData.someDateAfterThisDate(new Date().toISOString()),
      }),
    ).rejects.toThrow('User does not have privileged identity permission.');
  });

  test('should throw an error if no users exist in the privileged identity user group', async () => {
    const userId = 'non-privileged identity-user';
    jest.spyOn(MockUserGroupGateway.prototype, 'getUserGroupWithUsers').mockResolvedValue({
      id: 'groupId',
      name: 'Test User Group',
      users: [],
    });

    await expect(
      useCase.elevatePrivilegedUser(context, userId, SYSTEM_USER_REFERENCE, {
        groups: [],
        expires: MockData.someDateAfterThisDate(new Date().toISOString()),
      }),
    ).rejects.toThrow('User does not have privileged identity permission.');

    jest.spyOn(MockUserGroupGateway.prototype, 'getUserGroupWithUsers').mockResolvedValue({
      id: 'groupId',
      name: 'Test User Group',
      users: undefined,
    });

    await expect(
      useCase.elevatePrivilegedUser(context, userId, SYSTEM_USER_REFERENCE, {
        groups: [],
        expires: MockData.someDateAfterThisDate(new Date().toISOString()),
      }),
    ).rejects.toThrow('User does not have privileged identity permission.');
  });

  test('should return privileged identity users', async () => {
    const id = 'test-group';
    const name = 'Test User Group';
    const users = MockData.buildArray(MockData.getCamsUser, 4);
    jest.spyOn(MockUserGroupGateway.prototype, 'getUserGroupWithUsers').mockResolvedValue({
      id,
      name,
      users,
    });

    const result = await useCase.getPrivilegedIdentityUsers(context);
    const expected = users.map((user) => getCamsUserReference(user));
    expect(result).toEqual(expected);
  });

  test('should throw errors encountered calling getUserGroupWithUsers', async () => {
    jest
      .spyOn(MockUserGroupGateway.prototype, 'getUserGroupWithUsers')
      .mockRejectedValue(new Error('Boom'));
    await expect(useCase.getPrivilegedIdentityUsers(context)).rejects.toThrow(
      'Unable to get privileged identity users.',
    );
  });

  test('should return an PrivilegedIdentityUser for a given user Id', async () => {
    const user: PrivilegedIdentityUser = {
      documentType: 'PRIVILEGED_IDENTITY_USER',
      ...MockData.getCamsUserReference(),
      claims: { groups: [] },
      expires: '2026-01-01',
    };
    jest.spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser').mockResolvedValue(user);

    const result = await useCase.getPrivilegedIdentityUser(context, user.id);
    expect(result).toEqual(user);
  });

  test('should throw a NotFound error if the user is not found', async () => {
    const error = new NotFoundError('ADMIN-USE-CASE');
    jest.spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser').mockRejectedValue(error);

    await expect(useCase.getPrivilegedIdentityUser(context, 'invalidUserId')).rejects.toThrow(
      error,
    );
  });

  test('should throw an error if an error is encountered with getPrivilegedIdentityUser', async () => {
    const error = new Error('some unknown error');
    jest.spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser').mockRejectedValue(error);

    const expected = new UnknownError(expect.anything());
    await expect(useCase.getPrivilegedIdentityUser(context, 'invalidUserId')).rejects.toThrow(
      expected,
    );
  });

  test('should return a list of valid IdP groups names', async () => {
    const roleGroups = Array.from(LocalStorageGateway.getRoleMapping().keys());
    const officeGroups = MOCKED_USTP_OFFICES_ARRAY.map((office) => office.idpGroupName);

    const actual = await useCase.getRoleAndOfficeGroupNames(context);

    expect(actual.roles).toEqual(expect.arrayContaining(roleGroups));
    expect(actual.offices).toEqual(expect.arrayContaining(officeGroups));
  });

  test('should throw an error if an error is encountered with getPrivilegedIdentityClaimGroups', async () => {
    const error = new Error('some unknown error');
    jest.spyOn(MockOfficesGateway.prototype, 'getOffices').mockRejectedValue(error);

    const expected = new UnknownError(expect.anything());
    await expect(useCase.getRoleAndOfficeGroupNames(context)).rejects.toThrow(expected);
  });

  test('should delete privileged identity user', async () => {
    const deleteSpy = jest
      .spyOn(MockMongoRepository.prototype, 'deletePrivilegedIdentityUser')
      .mockResolvedValue();
    const userId = 'user-id';
    await useCase.deletePrivilegedIdentityUser(context, userId);
    expect(deleteSpy).toHaveBeenCalledWith(userId);
  });

  test('should throw when error is encountered during delete of privileged identity user', async () => {
    const error = new Error('some unknown error');
    const deleteSpy = jest
      .spyOn(MockMongoRepository.prototype, 'deletePrivilegedIdentityUser')
      .mockRejectedValue(error);

    const userId = 'user-id';
    await expect(useCase.deletePrivilegedIdentityUser(context, userId)).rejects.toThrow();
    expect(deleteSpy).toHaveBeenCalledWith(userId);
  });
});
