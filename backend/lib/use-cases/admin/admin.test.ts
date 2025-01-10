import { createMockApplicationContext } from '../../testing/testing-utilities';
import { AdminUseCase, CreateStaffRequestBody, DEFAULT_STAFF_TTL } from './admin';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsRole } from '../../../../common/src/cams/roles';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { Staff } from '../../../../common/src/cams/users';

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
      const createSpy = jest
        .spyOn(MockMongoRepository.prototype, 'putOfficeStaff')
        .mockResolvedValue();

      const user = MockData.getCamsUser({ roles: [CamsRole.CaseAssignmentManager] });
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
      .spyOn(MockMongoRepository.prototype, 'putOfficeStaff')
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
    const deleteSpy = jest
      .spyOn(MockMongoRepository.prototype, 'findAndDeleteStaff')
      .mockResolvedValue();

    await useCase.deleteStaff(context, testOffice, 'John Doe');
    expect(deleteSpy).toHaveBeenCalledWith(testOffice, 'John Doe');
  });

  test('should add to camsStack upon delete error', async () => {
    const message = 'Some error occurred.';
    jest
      .spyOn(MockMongoRepository.prototype, 'findAndDeleteStaff')
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
});
