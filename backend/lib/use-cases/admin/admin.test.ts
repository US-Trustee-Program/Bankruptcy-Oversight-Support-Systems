import { createMockApplicationContext } from '../../testing/testing-utilities';
import { AdminUseCase } from './admin';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsRole } from '../../../../common/src/cams/roles';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';

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

  test('should create new office staff entry', async () => {
    const createSpy = jest
      .spyOn(MockMongoRepository.prototype, 'putOfficeStaff')
      .mockResolvedValue();

    const user = MockData.getCamsUser({ roles: [CamsRole.CaseAssignmentManager] });
    delete user.offices;
    await useCase.addOfficeStaff(context, 'My_Test_Office', user, -1);
    expect(createSpy).toHaveBeenCalled();
  });

  test('should add to camsStack upon create error', async () => {
    const message = 'Some error occurred.';
    jest
      .spyOn(MockMongoRepository.prototype, 'putOfficeStaff')
      .mockRejectedValue(new CamsError(module, { message }));

    const user = MockData.getCamsUser({ roles: [CamsRole.CaseAssignmentManager] });
    delete user.offices;
    await expect(useCase.addOfficeStaff(context, testOffice, user, -1)).rejects.toThrow(
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
