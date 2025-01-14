import { createMockApplicationContext } from '../../testing/testing-utilities';
import { AdminUseCase, CreateStaffRequestBody } from './admin';
import { DEFAULT_STAFF_TTL } from '../offices/offices';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsRole } from '../../../../common/src/cams/roles';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { PrivilegedIdentityUser, Staff } from '../../../../common/src/cams/users';
import { MockOfficesRepository } from '../../testing/mock-gateways/mock.offices.repository';
import OktaUserGroupGateway from '../../adapters/gateways/okta/okta-user-group-gateway';
import { randomUUID } from 'node:crypto';
import { getCamsUserReference } from '../../../../common/src/cams/session';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { NotFoundError } from '../../common-errors/not-found-error';
import { UnknownError } from '../../common-errors/unknown-error';

describe('Test Migration Admin Use Case', () => {
  let context: ApplicationContext;
  let useCase: AdminUseCase;
  const module = 'TEST-MODULE';
  const testOffice = 'TEST_OFFICE_GROUP';

  beforeEach(async () => {
    context = await createMockApplicationContext();
    useCase = new AdminUseCase();
  });

  test('should record use case module on CAMS stack', async () => {
    await expect(useCase.deleteMigrations(context)).rejects.toThrow(
      expect.objectContaining({
        camsStack: [
          {
            message: 'Failed during migration deletion.',
            module: 'ADMIN-USE-CASE',
          },
        ],
      }),
    );
  });

  const successCases = [
    ['undefined', undefined, DEFAULT_STAFF_TTL],
    ['-1', -1, -1],
    ['3600', 3600, 3600],
  ];
  test.each(successCases)(
    'should create new office staff entry with %s ttl provided',
    async (_caseName: string, ttl: number, expectedTtl: number) => {
      const user = MockData.getCamsUser({ roles: [CamsRole.CaseAssignmentManager] });
      const createSpy = jest
        .spyOn(MockOfficesRepository, 'putOfficeStaff')
        .mockResolvedValue({ id: user.id, modifiedCount: 0, upsertedCount: 1 });

      const expectedUser: Staff = {
        id: user.id,
        name: user.name,
        roles: user.roles,
      };
      const requestBody: CreateStaffRequestBody = {
        officeCode: testOffice,
        ttl,
        ...expectedUser,
      };
      await useCase.addOfficeStaff(context, requestBody);
      expect(createSpy).toHaveBeenCalledWith(testOffice, expectedUser, expectedTtl);
    },
  );

  test('should add to camsStack upon create error', async () => {
    const message = 'Some error occurred.';
    jest
      .spyOn(MockOfficesRepository, 'putOfficeStaff')
      .mockRejectedValue(new CamsError(module, { message }));

    const user = MockData.getCamsUser({ roles: [CamsRole.CaseAssignmentManager] });
    const requestBody: CreateStaffRequestBody = {
      officeCode: testOffice,
      id: user.id,
      name: user.name,
      roles: user.roles,
      ttl: -1,
    };
    await expect(useCase.addOfficeStaff(context, requestBody)).rejects.toThrow(
      expect.objectContaining({
        message,
        module,
        camsStack: expect.arrayContaining([
          { module: expect.anything(), message: 'Failed to create staff document.' },
        ]),
      }),
    );
  });

  test('should remove office staff entry', async () => {
    const deleteSpy = jest.spyOn(MockOfficesRepository, 'findAndDeleteStaff').mockResolvedValue();

    await useCase.deleteStaff(context, testOffice, 'John Doe');
    expect(deleteSpy).toHaveBeenCalledWith(testOffice, 'John Doe');
  });

  test('should add to camsStack upon delete error', async () => {
    const message = 'Some error occurred.';
    jest
      .spyOn(MockOfficesRepository, 'findAndDeleteStaff')
      .mockRejectedValue(new CamsError(module, { message }));

    await expect(useCase.deleteStaff(context, testOffice, 'John Doe')).rejects.toThrow(
      expect.objectContaining({
        message,
        module,
        camsStack: expect.arrayContaining([
          { module: expect.anything(), message: 'Failed to delete staff document.' },
        ]),
      }),
    );
  });

  const augmentUserSuccessCases = [
    ['no expiration', undefined],
    ['expiration', '2025-01-14T00:00:00.000Z'],
  ];
  test.each(augmentUserSuccessCases)(
    'should add roles and offices to PrivilegedIdentityUser with %s',
    async (_caseName: string, expires: string) => {
      const users = MockData.buildArray(MockData.getCamsUser, 4);
      jest.spyOn(OktaUserGroupGateway, 'getUserGroupWithUsers').mockResolvedValue({
        id: randomUUID(),
        name: 'Test User Group',
        users,
      });
      const repoSpy = jest
        .spyOn(MockMongoRepository.prototype, 'putPrivilegedIdentityUser')
        .mockResolvedValue({ id: users[0].id, modifiedCount: 0, upsertedCount: 1 });

      const groups = ['USTP CAMS Case Assignment Manager', 'USTP CAMS Region 2 Office Manhattan'];

      const expected: PrivilegedIdentityUser = {
        id: users[0].id,
        name: users[0].name,
        documentType: 'PRIVILEGED_IDENTITY_USER',
        claims: { groups },
        expires,
      };

      await useCase.augmentUser(context, users[0].id, {
        groups,
        expires,
      });

      expect(repoSpy).toHaveBeenCalledWith(expected);
    },
  );

  test('should throw an error if augmentUser fails to augment the user', async () => {
    const user = MockData.getCamsUser();
    jest.spyOn(OktaUserGroupGateway, 'getUserGroupWithUsers').mockResolvedValue({
      id: 'groupId',
      name: 'Test User Group',
      users: [user],
    });

    jest
      .spyOn(MockMongoRepository.prototype, 'putPrivilegedIdentityUser')
      .mockResolvedValue({ id: null, modifiedCount: 0, upsertedCount: 0 });

    await expect(useCase.augmentUser(context, user.id, { groups: [] })).rejects.toThrow(
      'Failed to add privileged identity user.',
    );
  });

  test('should throw an error if the user to augment is not an privileged identity user', async () => {
    const userId = 'non-privileged identity-user';
    jest.spyOn(OktaUserGroupGateway, 'getUserGroupWithUsers').mockResolvedValue({
      id: 'groupId',
      name: 'Test User Group',
      users: [MockData.getCamsUser()],
    });

    await expect(useCase.augmentUser(context, userId, { groups: [] })).rejects.toThrow(
      'User does not have permission to be augmented.',
    );
  });

  test('should throw an error if no users exist in the privileged identity user group', async () => {
    const userId = 'non-privileged identity-user';
    jest.spyOn(OktaUserGroupGateway, 'getUserGroupWithUsers').mockResolvedValue({
      id: 'groupId',
      name: 'Test User Group',
      users: [],
    });

    await expect(useCase.augmentUser(context, userId, { groups: [] })).rejects.toThrow(
      'User does not have permission to be augmented.',
    );

    jest.spyOn(OktaUserGroupGateway, 'getUserGroupWithUsers').mockResolvedValue({
      id: 'groupId',
      name: 'Test User Group',
      users: undefined,
    });

    await expect(useCase.augmentUser(context, userId, { groups: [] })).rejects.toThrow(
      'User does not have permission to be augmented.',
    );
  });

  test('should return privileged identity users', async () => {
    const id = 'test-group';
    const name = 'Test User Group';
    const users = MockData.buildArray(MockData.getCamsUser, 4);
    jest.spyOn(OktaUserGroupGateway, 'getUserGroupWithUsers').mockResolvedValue({
      id,
      name,
      users,
    });

    const result = await useCase.getPrivilegedIdentityUsers(context);
    const expected = users.map((user) => getCamsUserReference(user));
    expect(result).toEqual(expected);
  });

  test('should throw errors encountered calling getUserGroupWithUsers', async () => {
    jest.spyOn(OktaUserGroupGateway, 'getUserGroupWithUsers').mockRejectedValue(new Error('Boom'));
    await expect(useCase.getPrivilegedIdentityUsers(context)).rejects.toThrow(
      'Unable to get privileged identity users.',
    );
  });

  test('should return an PrivilegedIdentityUser for a given user Id', async () => {
    const user: PrivilegedIdentityUser = {
      documentType: 'PRIVILEGED_IDENTITY_USER',
      ...MockData.getCamsUserReference(),
      claims: { groups: [] },
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

  test('should throw an error if an error is encountered on getPrivilegedIdentityUser', async () => {
    const error = new Error('some unknown error');
    jest.spyOn(MockMongoRepository.prototype, 'getPrivilegedIdentityUser').mockRejectedValue(error);

    const expected = new UnknownError(expect.anything());
    await expect(useCase.getPrivilegedIdentityUser(context, 'invalidUserId')).rejects.toThrow(
      expected,
    );
  });
});
