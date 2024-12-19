import { createMockApplicationContext } from '../../testing/testing-utilities';
import { AdminUseCase } from './admin';

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
});
