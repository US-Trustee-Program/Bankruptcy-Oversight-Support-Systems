import { vi } from 'vitest';
import handler from './case-trustee-appointment.function';
import { CaseTrusteeAppointmentController } from '../../../lib/controllers/cases/case-trustee-appointment.controller';
import ContextCreator from '../../azure/application-context-creator';
import MockData from '@common/cams/test-utilities/mock-data';
import { InvocationContext } from '@azure/functions';
import {
  buildTestResponseError,
  buildTestResponseSuccess,
  createMockAzureFunctionRequest,
} from '../../azure/testing-helpers';
import { NotFoundError } from '../../../lib/common-errors/not-found-error';
import { CaseAppointment } from '@common/cams/trustee-appointments';

const mockAppointment: CaseAppointment = {
  id: 'ca-001',
  caseId: '111-24-00001',
  trusteeId: 'trustee-abc',
  assignedOn: '2026-01-01T00:00:00Z',
  appointedDate: '2026-01-01',
  createdOn: '2026-01-01T00:00:00Z',
  createdBy: { id: 'system', name: 'System' },
  updatedOn: '2026-01-01T00:00:00Z',
  updatedBy: { id: 'system', name: 'System' },
};

describe('CaseTrusteeAppointmentFunction', () => {
  let invocationContext: InvocationContext;

  beforeEach(() => {
    vi.spyOn(ContextCreator, 'getApplicationContextSession').mockResolvedValue(
      MockData.getManhattanAssignmentManagerSession(),
    );
    invocationContext = new InvocationContext({
      logHandler: () => {},
      invocationId: 'id',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('returns 200 with CaseAppointment on success', async () => {
    const req = createMockAzureFunctionRequest({
      method: 'GET',
      params: { caseId: '111-24-00001' },
    });
    const { azureHttpResponse, camsHttpResponse } = buildTestResponseSuccess<CaseAppointment>({
      data: mockAppointment,
    });
    vi.spyOn(CaseTrusteeAppointmentController.prototype, 'handleRequest').mockResolvedValue(
      camsHttpResponse,
    );

    const response = await handler(req, invocationContext);

    expect(response).toEqual(azureHttpResponse);
  });

  test('returns 404 when controller throws NotFoundError', async () => {
    const req = createMockAzureFunctionRequest({
      method: 'GET',
      params: { caseId: '111-24-99999' },
    });
    const error = new NotFoundError('CASE-TRUSTEE-APPOINTMENT-CONTROLLER', {
      message: 'No active trustee appointment for case 111-24-99999',
    });
    const { azureHttpResponse } = buildTestResponseError(error);
    vi.spyOn(CaseTrusteeAppointmentController.prototype, 'handleRequest').mockRejectedValue(error);

    const response = await handler(req, invocationContext);

    expect(response).toEqual(azureHttpResponse);
  });
});
