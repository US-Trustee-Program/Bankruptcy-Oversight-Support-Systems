import { vi } from 'vitest';
import { StaffController } from '../../../lib/controllers/staff/staff.controller';
import { CamsError } from '../../../lib/common-errors/cams-error';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import StaffUseCase from '../../../lib/use-cases/staff/staff';
import handler from './staff.function';
import { InvocationContext } from '@azure/functions';
import { ResponseBody } from '../../../../common/src/api/response';
import { Staff } from '../../../../common/src/cams/users';
import { CamsRole, OversightRoleType } from '../../../../common/src/cams/roles';
import ContextCreator from '../../azure/application-context-creator';

describe('Staff Azure Function tests', () => {
  const request = createMockAzureFunctionRequest();
  const context = new InvocationContext();

  beforeEach(async () => {
    vi.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(
      MockData.getCamsSession(),
    );
    vi.spyOn(StaffUseCase.prototype, 'getOversightStaff').mockResolvedValue({});
  });

  const errorTestCases = [
    ['unexpected error', () => new Error()],
    ['CamsError error', () => new CamsError('fake-module')],
  ] as const;

  test.each(errorTestCases)(
    'Should return an HTTP Error if getOversightStaff() throws %s',
    async (_errorType, errorFactory) => {
      const error = errorFactory();
      const { azureHttpResponse } = buildTestResponseError(error);
      vi.spyOn(StaffController.prototype, 'handleRequest').mockRejectedValue(error);

      const response = await handler(request, context);

      expect(response).toEqual(azureHttpResponse);
    },
  );

  test('should return success with a Record of oversight staff grouped by role', async () => {
    const oversightStaff: Record<OversightRoleType, Staff[]> = {
      [CamsRole.TrialAttorney]: MockData.buildArray(MockData.getAttorneyUser, 3),
      [CamsRole.Auditor]: MockData.buildArray(MockData.getAuditorUser, 2),
      [CamsRole.Paralegal]: MockData.buildArray(MockData.getParalegalUser, 1),
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
    expect(response.status).toBe(200);

    // Verify Record structure
    expect(oversightStaff.TrialAttorney).toHaveLength(3);
    expect(oversightStaff.Auditor).toHaveLength(2);
    expect(oversightStaff.Paralegal).toHaveLength(1);
  });
});
