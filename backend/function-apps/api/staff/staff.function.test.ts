import { vi } from 'vitest';
import { StaffController } from '../../../lib/controllers/staff/staff.controller';
import MockData from '@common/cams/test-utilities/mock-data';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import StaffUseCase from '../../../lib/use-cases/staff/staff';
import handler from './staff.function';
import { InvocationContext } from '@azure/functions';
import { ResponseBody } from '@common/api/response';
import { Staff } from '@common/cams/users';
import { CamsRole, OversightRoleType } from '../../../../common/src/cams/roles';
import ContextCreator from '../../azure/application-context-creator';

describe('Staff Azure Function tests', () => {
  const request = createMockAzureFunctionRequest();
  const context = new InvocationContext();

  beforeEach(async () => {
    vi.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(
      MockData.getCamsSession(),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(StaffUseCase.prototype, 'getOversightStaff').mockResolvedValue({} as any);
  });

  test('Should return an HTTP Error if getOversightStaff() throws', async () => {
    const error = new Error();
    const { azureHttpResponse } = buildTestResponseError(error);
    vi.spyOn(StaffController.prototype, 'handleRequest').mockRejectedValue(error);

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });

  test('should return success with a Record of oversight staff grouped by role', async () => {
    const oversightStaff: Record<OversightRoleType, Staff[]> = {
      [CamsRole.OversightAttorney]: MockData.buildArray(MockData.getAttorneyUser, 3),
      [CamsRole.OversightAuditor]: MockData.buildArray(MockData.getAuditorUser, 2),
      [CamsRole.OversightParalegal]: MockData.buildArray(MockData.getParalegalUser, 1),
    };
    const body: ResponseBody<Record<OversightRoleType, Staff[]>> = {
      meta: {
        self: 'self-url',
      },
      data: oversightStaff,
    };
    const { camsHttpResponse, azureHttpResponse } =
      buildTestResponseSuccess<Record<OversightRoleType, Staff[]>>(body);
    vi.spyOn(StaffController.prototype, 'handleRequest').mockResolvedValue(camsHttpResponse);

    const response = await handler(request, context);

    expect(response).toEqual(azureHttpResponse);
  });
});
