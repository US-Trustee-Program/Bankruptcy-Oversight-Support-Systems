import { vi, describe, test, expect, beforeEach } from 'vitest';
import { TrusteeAppointmentVerificationController } from './trustee-appointment-verification.controller';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { CamsRole } from '@common/cams/roles';
import { CourtsUseCase } from '../../use-cases/courts/courts';
import { TrusteeAppointmentsUseCase } from '../../use-cases/trustee-appointments/trustee-appointments';
import { TrusteeAppointmentVerification } from '@common/cams/trustee-appointment-verification';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import MockData from '@common/cams/test-utilities/mock-data';
import { NotFoundError } from '../../common-errors/not-found-error';

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
    vi.spyOn(TrusteeAppointmentsUseCase.prototype, 'getTrusteeAppointments').mockResolvedValue([]);
    vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(
      MockData.getTrustee({ trusteeId: 'trustee-1', name: 'Jane Smith' }),
    );
  });

  test('GET returns the open appointment tasks as list items', async () => {
    const response = await new TrusteeAppointmentVerificationController().handleRequest(context);

    expect(response.statusCode).toBe(200);
    expect(response.body.data).toEqual([
      expect.objectContaining({ id: 'task-1', taskType: 'trustee-appointment', caseCount: 1 }),
    ]);
    expect(response.body.meta).toEqual({ self: context.request.url });
  });

  test("GET with an id returns that task's detail", async () => {
    const findById = vi.spyOn(MockMongoRepository.prototype, 'findById').mockResolvedValue(task);
    context.request.params = { id: 'task-1' };
    context.request.query = { trusteeId: 'trustee-1' };

    const response = await new TrusteeAppointmentVerificationController().handleRequest(context);

    expect(findById).toHaveBeenCalledWith('task-1', 'trustee-1');
    expect(search).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({ id: 'task-1', appointments: [] }));
    expect(response.body.meta).toEqual({ self: context.request.url });
  });

  test('a not-found error for an unknown id keeps its 404 status through the controller', async () => {
    const notFound = new NotFoundError('TRUSTEE-APPOINTMENT-VERIFICATION-MONGO-REPOSITORY', {
      message: 'Trustee appointment task missing not found.',
    });
    vi.spyOn(MockMongoRepository.prototype, 'findById').mockRejectedValue(notFound);
    context.request.params = { id: 'missing' };
    context.request.query = { trusteeId: 'trustee-1' };

    await expect(
      new TrusteeAppointmentVerificationController().handleRequest(context),
    ).rejects.toMatchObject({ status: 404 });
  });

  test('rejects a task detail request that has no trusteeId', async () => {
    const findById = vi.spyOn(MockMongoRepository.prototype, 'findById');
    context.request.params = { id: 'task-1' };
    context.request.query = {};

    await expect(
      new TrusteeAppointmentVerificationController().handleRequest(context),
    ).rejects.toThrow('Missing trusteeId.');
    expect(findById).not.toHaveBeenCalled();
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

  test('returns 404 for a task detail request when trustee-verification-enabled is off', async () => {
    context.featureFlags['trustee-verification-enabled'] = false;
    context.request.params = { id: 'task-1' };
    const findById = vi.spyOn(MockMongoRepository.prototype, 'findById');

    const response = await new TrusteeAppointmentVerificationController().handleRequest(context);

    expect(response.statusCode).toBe(404);
    expect(findById).not.toHaveBeenCalled();
  });

  test('rejects a task detail request from a user without the DataVerifier role', async () => {
    context.session.user.roles = [CamsRole.TrialAttorney];
    context.request.params = { id: 'task-1' };
    const findById = vi.spyOn(MockMongoRepository.prototype, 'findById');

    await expect(
      new TrusteeAppointmentVerificationController().handleRequest(context),
    ).rejects.toThrow('Unauthorized');
    expect(findById).not.toHaveBeenCalled();
  });

  describe('PATCH refresh', () => {
    beforeEach(() => {
      context.request.method = 'PATCH';
      context.request.params = { id: 'task-1' };
      context.request.query = { trusteeId: 'trustee-1' };
      context.request.body = { action: 'refresh' };
      vi.spyOn(MockMongoRepository.prototype, 'findById').mockResolvedValue(task);
    });

    test("refreshes the task by its id within the request's trusteeId and returns the outcome", async () => {
      const findById = vi.spyOn(MockMongoRepository.prototype, 'findById').mockResolvedValue(task);
      context.request.params = { id: 'task-9' };
      context.request.query = { trusteeId: 'trustee-7' };

      const response = await new TrusteeAppointmentVerificationController().handleRequest(context);

      expect(findById).toHaveBeenCalledWith('task-9', 'trustee-7');
      expect(response.statusCode).toBe(200);
      expect(response.body.data).toEqual(expect.objectContaining({ outcome: 'still-uncovered' }));
      expect(response.body.meta).toEqual({ self: context.request.url });
    });

    test.each([
      ['no id', { params: {} }, 'Missing task ID.'],
      ['no trusteeId', { query: {} }, 'Missing trusteeId.'],
      ['no action', { body: {} }, 'Missing or invalid action.'],
      ['an unknown action', { body: { action: 'reject' } }, 'Missing or invalid action.'],
      ['no body', { body: undefined }, 'Missing or invalid action.'],
    ])('rejects a request with %s', async (_, overrides, message) => {
      Object.assign(context.request, overrides);
      const findById = vi.spyOn(MockMongoRepository.prototype, 'findById');

      await expect(
        new TrusteeAppointmentVerificationController().handleRequest(context),
      ).rejects.toThrow(message);
      expect(findById).not.toHaveBeenCalled();
    });
  });

  test('rejects any method other than GET or PATCH', async () => {
    context.request.method = 'POST';

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
