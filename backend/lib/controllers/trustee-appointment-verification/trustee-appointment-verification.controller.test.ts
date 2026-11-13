import { vi, describe, test, expect, beforeEach } from 'vitest';
import { TrusteeAppointmentVerificationController } from './trustee-appointment-verification.controller';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { CamsRole } from '@common/cams/roles';
import { CourtsUseCase } from '../../use-cases/courts/courts';
import { TrusteeAppointmentVerification } from '@common/cams/trustee-appointment-verification';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';

describe('TrusteeAppointmentVerificationController', () => {
  let context: ApplicationContext;
  let search: ReturnType<typeof vi.spyOn>;

  const task: TrusteeAppointmentVerification = {
    id: 'task-1',
    documentType: 'TRUSTEE_APPOINTMENT_VERIFICATION',
    taskType: 'trustee-appointment',
    trusteeId: 'trustee-1',
    courtId: '081',
    divisionCode: '081',
    chapter: '7',
    reason: 'no-appointment',
    caseIds: ['081-24-00001'],
    status: 'pending',
    createdOn: '2026-11-01T00:00:00.000Z',
    createdBy: SYSTEM_USER_REFERENCE,
    updatedOn: '2026-11-01T00:00:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
  };

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    context.featureFlags['trustee-verification-enabled'] = true;
    context.request.method = 'GET';
    context.session.user.roles = [CamsRole.DataVerifier];
    search = vi.spyOn(MockMongoRepository.prototype, 'search').mockResolvedValue([task]);
    vi.spyOn(CourtsUseCase.prototype, 'getCourts').mockResolvedValue([]);
  });

  test('GET returns the open appointment tasks as list items', async () => {
    const response = await new TrusteeAppointmentVerificationController().handleRequest(context);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toEqual([
      expect.objectContaining({ id: 'task-1', taskType: 'trustee-appointment', caseCount: 1 }),
    ]);
    expect(response.body.meta).toEqual({ self: context.request.url });
  });

  test('returns 404 when trustee-verification-enabled is off', async () => {
    context.featureFlags['trustee-verification-enabled'] = false;

    const response = await new TrusteeAppointmentVerificationController().handleRequest(context);

    expect(response.statusCode).toBe(404);
    expect(search).not.toHaveBeenCalled();
  });

  test('rejects a user without the DataVerifier role', async () => {
    context.session.user.roles = [CamsRole.TrialAttorney];

    await expect(
      new TrusteeAppointmentVerificationController().handleRequest(context),
    ).rejects.toThrow('Unauthorized');
    expect(search).not.toHaveBeenCalled();
  });

  test('rejects any method other than GET', async () => {
    context.request.method = 'PATCH';

    await expect(
      new TrusteeAppointmentVerificationController().handleRequest(context),
    ).rejects.toThrow('Unsupported method.');
    expect(search).not.toHaveBeenCalled();
  });

  test('wraps a repository failure as a CamsError', async () => {
    search.mockRejectedValue(new Error('boom'));

    await expect(
      new TrusteeAppointmentVerificationController().handleRequest(context),
    ).rejects.toMatchObject({ module: 'TRUSTEE-APPOINTMENT-VERIFICATION-CONTROLLER' });
  });
});
