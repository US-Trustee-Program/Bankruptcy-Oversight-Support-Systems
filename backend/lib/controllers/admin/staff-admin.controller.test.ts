import { createMockApplicationContext } from '../../testing/testing-utilities';
import { StaffAdminController } from './staff-admin.controller';
import { AdminUseCase } from '../../use-cases/admin/admin';
import { CamsRole } from '../../../../common/src/cams/roles';

describe('Admin controller tests', () => {
  let controller: StaffAdminController;

  beforeEach(async () => {
    controller = new StaffAdminController();
  });

  test('should return 204 for successful deletion of staff', async () => {
    const context = await createMockApplicationContext();
    context.request.method = 'DELETE';
    context.request.params.procedure = 'deleteStaff';
    context.request.body = {
      officeCode: 'TEST_OFFICE_GROUP',
      id: 'user-okta-id',
    };
    jest.spyOn(AdminUseCase.prototype, 'deleteStaff').mockResolvedValue();
    const response = await controller.handleRequest(context);
    expect(response).toEqual({ statusCode: 204 });
  });

  const successfulUpsertCases = [
    ['201 for create', 201, 0, 1],
    ['204 for update', 204, 1, 0],
  ];
  test.each(successfulUpsertCases)(
    'should return %s',
    async (_caseName: string, statusCode: number, modifiedCount: number, upsertedCount: number) => {
      const context = await createMockApplicationContext();
      const id = 'user-idp-id';
      context.request.method = 'POST';
      context.request.params.procedure = 'createStaff';
      context.request.body = {
        officeCode: 'TEST_OFFICE_GROUP',
        id,
        name: 'Last, First',
        roles: [CamsRole.CaseAssignmentManager],
      };
      jest
        .spyOn(AdminUseCase.prototype, 'addOfficeStaff')
        .mockResolvedValue({ id, modifiedCount, upsertedCount });
      const response = await controller.handleRequest(context);
      expect(response).toEqual({ statusCode });
    },
  );
});
