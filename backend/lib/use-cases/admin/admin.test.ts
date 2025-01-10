import { createMockApplicationContext } from '../../testing/testing-utilities';
import { AdminUseCase } from './admin';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsRole } from '../../../../common/src/cams/roles';

describe('Test Migration Admin Use Case', () => {
  test('should record use case module on CAMS stack', async () => {
    const context = await createMockApplicationContext();
    const useCase = new AdminUseCase();
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
    const context = await createMockApplicationContext();
    const useCase = new AdminUseCase();
    const createSpy = jest
      .spyOn(MockMongoRepository.prototype, 'putOfficeStaff')
      .mockResolvedValue();

    const user = MockData.getCamsUser({ roles: [CamsRole.CaseAssignmentManager] });
    await useCase.addOfficeStaff(context, 'My_Test_Office', user, -1);
    expect(createSpy).toHaveBeenCalled();
  });
});
